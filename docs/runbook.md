# MYSEOULDROP 운영 런북 (1페이지)

> 대상: https://seoul-guide-v2.vercel.app · Vercel `seoul-guide-v2` · Supabase `supabase-indigo-mountain`

## 장애 감지 채널

| 채널 | 무엇을 | 어디서 |
|---|---|---|
| GitHub Actions **Uptime** | 30분마다 홈·맵·함수 레이어 probe, 실패 시 워크플로 failure → 저장소 알림 메일 | Actions 탭 → Uptime |
| **client_errors** 테이블 | 브라우저 런타임 에러·unhandled rejection·에러 바운더리 (세션당 10건 캡, 중복 제거) | 아래 SQL |
| **feedback** 테이블 | 사용자 신고 ("Something off?") | 아래 SQL |

에러/피드백 조회 (service role — Supabase Dashboard SQL Editor 또는 로컬 psql):

```sql
select created_at, kind, message, page, release
from client_errors order by created_at desc limit 50;

select created_at, category, message, page
from feedback order by created_at desc limit 50;
```

## 증상별 대응

**앱 전체 5xx / Uptime DOWN**
1. https://www.vercel-status.com 확인 → 플랫폼 장애면 대기
2. 최근 배포가 원인이면 **롤백**: Vercel Dashboard → seoul-guide-v2 → Deployments → 직전 정상 배포 → ⋯ → *Promote to Production* (또는 `git revert <sha> && git push` — main 푸시가 자동 배포)
3. 롤백 후 Uptime 워크플로를 workflow_dispatch로 수동 실행해 회복 확인

**로그인/데이터 저장만 실패 (지도는 정상)**
1. https://status.supabase.com 확인
2. Supabase Dashboard → Logs → API에서 4xx/5xx 패턴 확인
3. RLS 정책 변경이 최근에 있었다면 되돌리기 (`supabase/migrations/` 이력 참고)

**확인 메일이 안 옴**
- Supabase 내장 메일러는 시간당 발송 제한이 있음. Dashboard → Auth → Rate Limits 확인. 근본 해결은 커스텀 SMTP(도메인 필요, HANDOFF P1 참고)

**Uptime이 403으로 실패 경보**
- Vercel 봇 챌린지는 정상(403=엣지 살아있음)으로 처리하도록 되어 있음. 그 외 403이 지속되면 Deployment Protection 설정이 켜졌는지 확인

**client_errors가 같은 메시지로 급증**
- `release` 컬럼(커밋 SHA)으로 어느 배포부터인지 특정 → 해당 커밋 revert 또는 fix-forward

## 데이터 정리

```sql
-- 30일 지난 에러 로그 정리 (필요 시 수동)
delete from client_errors where created_at < now() - interval '30 days';
```

## 키/시크릿

- `.env.local`은 `vercel env pull --yes`로 재생성 (커밋 금지)
- service role 키가 유출 의심되면: Supabase Dashboard → Settings → API → **Rotate** 후 Vercel env 갱신 → 재배포

## 롤백 절차 (A12 — 2026-08-17)

전제: 배포 = main 푸시(Vercel 자동). **DB 마이그레이션은 롤백하지 않는다** —
스키마는 하위호환으로만 진화시키고, 코드만 되돌린다.

1. 직전 정상 SHA 특정: `git log --oneline` + client_errors의 `release` 컬럼
   (급증 시작 배포의 바로 앞 커밋), 또는 Vercel Deployments의 마지막 Ready 배포
2. 되돌리기(택1):
   - **Vercel 대시보드** → Deployments → 정상 배포 → *Promote to Production* (가장 빠름, 코드 이력 안 건드림)
   - **git revert** `git revert <bad_sha> && git push` (이력 남는 정석 — force push 금지)
3. 확인: 프로덕션 헤드리스 스모크(지도→상세→로그인 화면) + client_errors 신규 유입 중단 확인
4. 후속: 원인 커밋은 fix-forward로 재배포. 롤백 시각·SHA·원인을 HANDOFF에 기록

**장애 공지 템플릿** (오픈 후 사용, 30분 내 1차 / 24시간 내 사후):
- 30분: "일부 기능(◯◯)에 문제가 있어 확인 중입니다. 저장된 데이터는 안전합니다. (시각)"
- 24시간: "◯◯ 문제를 (시각)에 해결했습니다. 원인: 한 줄. 재발 방지: 한 줄. 영향받은 기간: ◯◯."

## 리뷰 모더레이션 운영 (B12 — 3인 신고 자동숨김의 사람 쪽 절차)

service role로 실행 (신고 테이블은 API 읽기 차단):

```sql
-- 신고 대기열: 신고 수·사유별 집계 (최근 30일)
select r.id, r.place_id, left(r.body, 80) as body, r.hidden,
       count(rr.id) as reports, array_agg(distinct rr.reason) as reasons
from ratings r join review_reports rr on rr.rating_id = r.id
where rr.created_at > now() - interval '30 days'
group by r.id order by reports desc;

-- 판정: 위반 확정 → 영구 숨김 유지(별도 조치 불필요, hidden=true 유지)
-- 오신고 → 복구:
update ratings set hidden = false where id = '<rating_id>';
-- 악성 반복 신고자 확인:
select reporter, count(*) from review_reports
group by reporter having count(*) > 10 order by count(*) desc;
```

- 자동숨김 임계: 서로 다른 계정 3인 (`review_reports_auto_hide` 트리거)
- 복구하면 신고 레코드는 남는다 — 같은 리뷰가 재신고 3인이 되면 다시 숨음.
  반복 오신고가 확인되면 해당 신고 행을 삭제해 카운트를 리셋:
  `delete from review_reports where rating_id='<id>' and reporter='<uid>';`
- 판정 SLA·금지 기준은 오너 결정 대기 (launch-checklist B12)
