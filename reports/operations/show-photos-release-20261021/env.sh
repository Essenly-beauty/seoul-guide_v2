# MYSEOULDROP show_photos 릴리스 공통 환경(zsh, 비밀값 없음). 모든 Bash 호출의 첫 줄:
#   source /Users/hanmyeong-gwan/myseouldrop-ops/show-photos/env.sh
# 실행자(Claude 세션)의 Bash 도구는 호출마다 변수와 함수를 잃는다. 이 파일이 매 호출의 상태를 똑같이 다시 만든다.
# err_exit: 실패한 명령에서 멈춘다(&&·|| 목록 안의 실패는 예외이므로 가드는 `|| stop` 으로 쓴다).
# no_unset: 정의되지 않은 변수를 오류로 본다. pipe_fail: 파이프 중간의 실패도 실패로 본다.
setopt err_exit no_unset pipe_fail
umask 077
OPS=/Users/hanmyeong-gwan/myseouldrop-ops/show-photos            # 영구 보관(0700): 실행 파일, 증거, 백업, CA, Vercel 관리자 설정 사본
RUN=$OPS/run                                                      # 검토된 실행 파일과 증거 JSON
BK=$OPS/backup                                                    # 덤프(개인정보 없음: 스키마 + 원장·버킷 행)
W=$OPS/integrate                                                  # 통합용 클론(GitHub에서 새로 받는다. 공유 작업 트리와 git 디렉터리를 나누지 않는다)
R=/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018   # 기능 작업 트리(Codex 공유): 자격 증명 파일만 읽는다
PLAN=/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018/reports/operations/show-photos-release-20261021
CA=$OPS/ca/supabase-prod-ca-2021.crt
F=2d169309e6bb1fc8c2f004228132af98b4df9354                         # 기능 브랜치(2d16930 = e608426 + 화면 점검 수정 2커밋)
B=b26586bd65f894bf4eb54d0405add238b39d4c0d                         # GitHub main (A0에서 확인)
T=64bd96528c78dd718359146d85295145fd8f9800                         # 2d16930^{tree}
PREV_DPL=dpl_2ZEE7c1s3WdeyB5Et94e6bvxxAQb                          # b26586b 운영 배포(앱 롤백 기준)
REPO=Essenly-beauty/seoul-guide_v2
ORIGIN=https://myseouldrop.app
ALT=https://seoul-guide-v2.vercel.app
VTEAM=team_F8hIyOkJ9p0Bdyn44Phngi1a
VSCOPE=admin-28156576s-projects
VPRJ=prj_5eidC5l66Xu01vsVyJhpmv5H3qXf
P=ct-more-on-hair-seongsu-branch                                   # 점검용 장소(게시 안 됨, 사진 없음)
PH=ados-dakyo-nail-seongsu                                         # 사진 5장 장소(콜라주 3칸, +2, 라이트박스)
C=supabase_db_partner-app-20261018-Io8Zlv                          # 로컬 Docker(pg 17.6), 리허설 포트 54382
export GIT_SSH_COMMAND="ssh -F /dev/null -i $HOME/.ssh/id_ed25519_gksaudrhks12_sys -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes"
M=$(cat "$RUN/merge-sha" 2>/dev/null || true)                      # A1 뒤에만 값이 있다. ⚠ 명령 앞에서 ${M:?} 로 확인한다
MDPL=$(cat "$RUN/m-deployment-id" 2>/dev/null || true)             # B2 뒤에만 값이 있다
REL=${M[1,12]}                                                     # client_errors.release 는 SHA 앞 12자다
ghs() { GH_TOKEN="$(gh auth token --user gksaudrhks12-sys)" gh "$@"; }   # 활성 gh 계정(회사)은 그대로 두고 토큰은 출력하지 않는다
vadm() { (cd "$OPS" && vercel --global-config "$OPS/vercel-admin" --scope "$VSCOPE" "$@"); }   # 관리자 Vercel 계정. 기본 CLI 계정은 쓰지 않는다
rpsql() { PGPASSWORD="${REHEARSAL_PGPASSWORD:-postgres}" docker exec -i -e PGPASSWORD "$C" "$@"; }   # 로컬 리허설 DB 전용
stop() { print -u2 -r -- "STOP: $*"; exit 1; }
# 지금 운영 대상 배포: {id, readyState, sha, ref} (Vercel 프로젝트의 targets.production)
prod_state() { vadm api "/v9/projects/$VPRJ?teamId=$VTEAM" | jq -c '.targets.production | {id, readyState, sha: .meta.githubCommitSha, ref: .meta.githubCommitRef}'; }
# 운영 = M 단언: GitHub main, 프로젝트 운영 대상, 두 운영 도메인이 모두 M 배포(MDPL)를 가리켜야 한다.
# 주의: zsh 에서 "$M:..." 은 콜론 수식어로 해석된다. 콜론 앞 변수는 항상 ${M} 처럼 중괄호로 쓴다.
assert_prod_is_m() {
  : ${M:?A1 전이다} ${MDPL:?B2 전이다}
  test "$(git ls-remote "git@github.com:${REPO}.git" refs/heads/main | cut -f1)" = "$M" || stop "GitHub main 이 M 이 아니다"
  prod_state | jq -e --arg d "$MDPL" --arg m "$M" '.id == $d and .readyState == "READY" and .sha == $m and .ref == "main"' >/dev/null || stop "프로젝트 운영 대상이 M 배포가 아니다: $(prod_state)"
  for u in "$ORIGIN" "$ALT"; do
    vadm inspect "$u" --json | jq -e --arg d "$MDPL" '.id == $d and .target == "production" and .readyState == "READY"' >/dev/null || stop "$u 가 M 배포를 가리키지 않는다"
  done
}
