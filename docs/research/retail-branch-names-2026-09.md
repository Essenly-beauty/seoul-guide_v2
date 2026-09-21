# 리테일 지점 영문명 교정 (Daiso / Olive Young) — 2026-09-21

오너 리포트(2026-09-20, 다이소 목록 스크린샷): **서로 구별되지 않는 지점 이름.** 산출물은 둘뿐이다 —
`scripts/lib/en-name-overrides.json`(**268건**, id 기준, 빌더가 재적용)과 이 문서. `lib/generated/*.ts`, `nameKr`, 좌표, id는 건드리지
않았다.

## 1. 무엇이 잘못됐나 (숫자)

공개 `PLACES` 878건 중 리테일 520건(daiso 284 + olive_young 236).

### 1-1. 잘림 충돌 — `truncationCollisions()`(lib/place-name-en.ts): 구별 불가능한 건수 / 그룹 수

| 대상 | @20 | @24 | @28 |
|---|---|---|---|
| 전체 878 — 이전 | 99 / 40g | 32 / 15g | 19 / 9g |
| 전체 878 — **이후** | **104 / 40g** | **27 / 12g** | **15 / 7g** |
| daiso — 이전 → 이후 | 24 / 10g → **21 / 7g** | 4 / 2g → **2 / 1g** | 4 / 2g → **2 / 1g** |
| olive_young — 이전 → 이후 | 46 / 19g → **54 / 22g** | 17 / 8g → **14 / 6g** | 6 / 3g → **4 / 2g** |

**@20에서 olive_young이 나빠진 것은 작명 실패가 아니라 산술이다.** `"Olive Young "`가 20자 중 12자를 먹는다. 남는 8자에 들어가야 할
Apgujeong·Cheongnyangni·Yeongdeungpo·Myeongdong·Seolleung은 전부 8자 이상 — **어떤 이름을 붙여도 충돌한다.** 증명: 목록 행에서 체인
워드만 빼고 다시 재면 olive_young **22그룹 → 0그룹**, daiso 7 → 1(강남고속버스터미널 쌍만 잔존). §7-1의 결정 하나가 이 문제를 끝낸다.

### 1-2. 읽을 수 없는 토큰 / 개별 결함

long-title-policy-2026-09.md §4-3의 게이트(최장 토큰 **>18자**, 베이스라인 88) 기준 **88건 → 33건(−62%)**. 88건 전부가 리테일이었고 남은
33건은 §6의 미해결 행이다. 교정 268건 안에서: 알려진 오표기 문자열 (`Rotde`·`Hompeulreoseu`·`Cheongryangri`·`Eebeuridei` …) **86 → 0** /
없는 거리 발명 **22건 제거** / `yeok` 누출 **17건 제거** / 지점 구분자(`본점`·`N호점`) **35건 복원** / 이름이 완전히 같은 쌍 **이후 0건**.

## 2. 파이프라인 근본 원인

`englishizeName()`(`scripts/lib/hangul-romanize.mjs:218`)과 그 near-duplicate인
`englishizeDaisoName()`/`romanizeHangul()`(`lib/english-place-name.ts:32`/`:16`)는 한글을 **음절 단위로** 음역하고 그 런을 **구분자 없이**
붙인다.

1. **단어 경계 파괴** — `하나로마트동서울농협장안점` → `Hanaromateudongseoulnonghyeopjangan`(35자 한 토큰). 지점을 식별하게 해 줄 경계가
   사라진다.
2. **음운 동화 미반영** — 음절 단위라 경계 변화를 볼 수 없다. `청량리`→`Cheongryangri`(정: **Cheongnyangni**),
   `선릉`→`Seonreung`(**Seolleung**), `신림`→`Sinrim`(**Sillim**), `답십리`→`Dapsipri`(**Dapsimni**).
3. **외래어 역음역** — `홈플러스`→`Hompeulreoseu`(**Homeplus**), `롯데백화점`→`Rotdebaekhwajeom`(**Lotte Department Store**),
   `용산아이파크몰`→`Yongsanaipakeumol`(**Yongsan IPARK Mall**).

접미사 테이블의 독립된 버그 둘(§7-2에서 코드로 수정): `DAISO_SUFFIXES`의 `["본점", ""]` (lib/english-place-name.ts:11) 한 줄이 본점 표시를
**지운다**; `["거리점", " St."]`가 `사거리점`의 **마지막 3글자**에 먼저 걸려 없는 거리를 만든다(`미아사거리점` → `Daiso Miasa St.`) —
교차로 25건 중 25건이 틀렸고 진짜 `거리`는 4건뿐.

**2026-08-23 "English-first titles" 결정은 유지된다.** 바뀌는 것은 영문의 **출처**뿐 — 기계 음역은 표시 이름에서 물러나 원래 목적인
**매칭 신호**로 돌아간다(raw/06-i18n-seo-community.md, §4-4에 이미 기록됨).

## 3. 규칙

```
NAME = [체인] [호스트 벤더] [헤드] [수식어…] [지점 표시]
```

1. **지점 표시 분리** — `본점`→` Main`, `N호점`→` N`, 맨 `점`→없음. 앞 둘은 **구분자이므로 절대 안 버린다.**
2. **수식어 분리**(긴 패턴 우선) — `역사`→`Stn. Bldg.`, `역N호선`→`Stn. Line N`, `역사거리`→`Stn.`+`Intersection`, `역`→`Stn.`,
   `사/오/삼/네거리`→`Intersection`, `중앙`→`Central`, `구청`→`-gu Office`, `시장`→`Market`, `정문`→`Main Gate`,
   `남부/북부`→`South/North`. **분리 전 가드**: 남은 core 전체가 역 이름이면 아무것도 떼지 않는다 — `동대문역사문화공원`(역사 포함),
   `미아사거리`, `신대방삼거리`, `신정네거리`, `어린이대공원`(이대 포함).
3. **호스트 벤더 분리** — 홈플러스·롯데마트·이마트 등. `농협`은 어디 있든 버린다(§4). **헤드 해석 우선순위**는 P0 올리브영 공식 영문 →
   P1 역 이름 → P2 체인/벤더 → P3 지역 로마자화 → 미해결.
4. **로마자화 게이트(P3 전용)** — 어떤 테이블에도 없고 **모든 음절 경계가 안전할 때만**. *위험 경계* = 왼쪽 음절에 받침이 있고 오른쪽
   초성이 `ㄴ`/`ㄹ`/`ㅁ`. §2-(2)의 오류가 전부 이 경우다. 하나라도 위험하면 **미해결로 올린다. 추측하지 않는다.**
5. **길이** — 목표 32자, 상한 36자. 줄이는 순서: 약어(`Station`→`Stn.`) → `농협` 제거 → 헤드가 이미 시설을 지칭하면 ` Stn.` 제거(`…
   Terminal`/`… Park`/`… Univ.`) → 호스트 체인 워드 제거. **단어 중간을 자르지 않는다. 구분자(`Main`·번호·`Central`·`Stn.
   Bldg.`·`South`)를 버리지 않는다.**

**어휘 출처**

- **역 이름 — `lib/subway.ts`/`lib/subway-data.json`의 검증된 600개 역. 이 작업의 지렛대.** `가락시장`=Garak Market,
  `청량리`=Cheongnyangni, `한성대입구`=Hansung Univ., `고속터미널`=Express Bus Terminal. 역 600개는 가독성 임계 위반이 0건 — 복제할
  선례다.
- **올리브영 공식 영문**: `시청`=City Hall, `압구정중앙`=Apgujeong Central. **적용 전 스냅샷 필요**(§7-2).
- **체인/벤더** 검증: Homeplus, Lotte Mart, Emart, IPARK Mall, COEX Mall, Times Square / 추정(medium): Hanaro Mart, GS The Fresh, Emart
  Everyday, Enter Six. **행정 접미사**: `동`→`-dong`, `로`→`-ro`, `대로`→`-daero`, `길`→`-gil`, `N가`→`N-ga`.

역 이름 정규화(적용 완료): 꼬리 괄호 제거(**앞 공백 없는 `Heukseok(Chung-Ang Univ.)`도 포함**), 굽은→곧은 따옴표, 대소문자(`hyochang
park`), `Univ`→`Univ.`, `Seoul-forest`→`Seoul Forest`. 괄호가 답인 둘은 뒤집는다: `총신대입구`=`Chongshin Univ. (Isu)`→**Isu**,
`흑석`지점→**Heukseok**/`중앙대`지점→**Chung-Ang Univ.**

## 4. 협동조합 이름은 장소 이름이 아니다

가장 큰 단일 교정. `하나로마트동서울농협장안점`의 `동서울농협`은 **조합 이름**이지 장소가 아니다. 주소는 `동대문구 한천로 193 (장안동)` —
장소는 **장안동**이다. "Dongseoul"은 광진구 강변역의 **동서울종합터미널** (5 km 밖)로 읽히고, 리포의 역 파일 자체가 `강변 = Gangbyeon
(Dongseoul Bus Terminal)`로 적고 있다. 조합명을 통째로 버리면 형제 행 `…동서울농협신내점`과도 비로소 구별된다 — 리포트 ④가 요구한 것.
마찬가지로 "Seoul Central"은 한강변 광진구 매장을 도심으로, "West Seoul"은 종로구 매장을 서쪽으로 오도한다.

| nameKr | 조합명 | 주소의 장소 | 결과 |
|---|---|---|---|
| 하나로마트**동서울농협**장안점 | 동서울농협 | 동대문구 (장안동) | `Daiso Hanaro Mart Jangan` |
| 하나로마트**동서울농협**신내점 | 동서울농협 | 중랑구 (신내동) | `Daiso Hanaro Mart Sinnae` |
| 하나로마트**서울중앙농협**점 | 서울중앙농협 | 광진구 (자양동) | `Daiso Hanaro Mart Jayang` |
| 하나로마트**서서울농협**사직점 | 서서울농협 | 종로구 (사직동) | `Daiso Hanaro Mart Sajik` |
| 하나로마트**서울서남부농협**점 | 서울서남부농협 | 관악구 (신림동) | `Daiso Hanaro Mart Sillim` |

## 5. 가장 중요한 교정 20건

| nameKr | 이전 | 이후 | 근거 |
|---|---|---|---|
| 청량리역점 | Daiso Cheongryangri Stn. | **Daiso Cheongnyangni Stn.** | 대표 오표기. 역 파일과 올리브영 공식 영문 일치 |
| 올리브영 청량리역사점 | …Cheongryangriyeoksa | **…Cheongnyangni Stn. Bldg.** | 리포트 ①. `역사`=역 건물 |
| 올리브영 청량리중앙점 | …Cheongryangrijungang | **…Cheongnyangni Central** | 리포트 ①의 짝 (33자) |
| 강남고속버스터미널점 | …gosokbeoseuteomineol | **Daiso Gangnam Express Bus Terminal** | 리포트 ②. `고속터미널` 공식 영문 |
| 강남고속버스터미널2호점 | …teomineol2ho | **… Express Bus Terminal 2** | 리포트 ②. 번호가 보인다 |
| 올리브영 영등포역점 | (이미 정상) | Olive Young Yeongdeungpo Stn. | 리포트 ③ 3중 충돌의 1 |
| 올리브영 영등포역사점 | …Yeongdeungpoyeoksa | **…Yeongdeungpo Stn. Bldg.** | 리포트 ③의 2 |
| 올리브영 영등포타임스퀘어점 | …taimseukweeo | **…Yeongdeungpo Times Square** | 리포트 ③의 3. 37자(유일한 예산 초과) |
| 하나로마트동서울농협장안점 | …nonghyeopjangan | **Daiso Hanaro Mart Jangan** | 리포트 ④. §4 |
| 하나로마트동서울농협신내점 | …nonghyeopsinnae | **Daiso Hanaro Mart Sinnae** | 리포트 ④의 짝 |
| 노원본점 | Daiso Nowon | **Daiso Nowon Main** | 리포트 ③(구분자 소실). `["본점",""]` 한 줄이 원인 |
| 봉천본점 / 봉천2호점 | Daiso Bongcheon / …2ho | **Bongcheon Main** / **Bongcheon 2** | 같은 결함의 쌍 |
| 강남역2호점 | Daiso Gangnamyeok2ho | **Daiso Gangnam Stn. 2** | `yeok` 누출 = Gangnam/Gangnamyeok 불일치의 정체 |
| 한성대입구역2호점 | …Hanseongdaeipguyeok2ho | **Daiso Hansung Univ. Stn. 2** | 대학 공식 영문 채택으로 변형이 소멸 |
| 신림3호점 | Daiso Sinrim3ho | **Daiso Sillim 3** | ㄴ→ㄹ 동화. 역 테이블이 답을 갖고 있었다 |
| 홈플러스방학점 | …Hompeulreoseubanghak | **Daiso Homeplus Banghak** | 오너가 지목한 5개 오표기 중 하나 |
| 용산아이파크몰점 | Daiso Yongsanaipakeumol | **Daiso Yongsan IPARK Mall** | 오너 지목. 몰 공식 표기는 IPARKMALL(붙임) — 띄어쓰기는 의도적 |
| 미아사거리점 | Daiso Miasa St. | **Daiso Miasageori** | 없는 거리 발명. 역 이름 통째 매칭 |
| 올리브영 롯데백화점잠실점 | …Rotdebaekhwajeomjamsil | **Olive Young Lotte Jamsil** | 42자 → 24자 |
| 올리브영 시청역점 | Olive Young Sicheong Stn. | **Olive Young City Hall Stn.** | 공공 명사는 번역이지 로마자화가 아니다 |

## 6. 미해결 — 그리고 그 이유

리테일 520건 중 **252건은 교정하지 않았다.** 대부분 이미 정상이고 **33건**은 여전히 읽을 수 없다 — 전부 **바깥 출처나 오너 결정이
필요한** 행이다. 추측하지 않았다.

| 사유 | 건수 | 예 |
|---|---|---|
| 지역 마트·건물 (출처 없음) | ~18 | 굿모닝마트, 바다마트, 식자재마트, 타워팰리스, 이스트폴, 스타시티 |
| 전통시장 | ~6 | 목동깨비시장, 금호금남시장, 성대시장, 대지시장 |
| 대학·병원 | ~5 | 명지대(공식 Myongji), 경희대(Kyung Hee), 순천향(Soonchunhyang), 동덕여대 |
| 예산 초과(36자 벽) | 3 | 용산아이파크몰더센터(41), 건대커먼그라운드(38), 잠실학원사거리(38) |
| 오너 결정 | 5 | `N성수`, `플러스점`, `센트럴 명동 타운`, `던던동대문점`, `롯데백화점본점면세점` |

**공식 영문은 규칙으로 도출되지 않는다.** 기계는 순천향을 `Suncheonhyang`으로 만들지만 학교는 `Soonchunhyang`으로 쓰고, 연세는 게이트를
통과해 `Yeonse`가 되지만 정답은 `Yonsei`다. 이 행들이 기다리는 것은 로마자화가 아니라 **조사(lookup)** 다.

**의도적으로 제외한 2건** — `교대역점`/`서울대입구점`은 규칙상 `Daiso Seoul Nat'l Univ. of Educ.` / `Daiso Seoul Nat'l Univ. Stn.`로
풀린다. 둘 다 역의 **공식** 영문이지만 **앞 24자가 동일하다** — 서로 다른 두 역이 화면에서 구별되지 않게 되므로, 즉 오너가 신고한 바로 그
버그를 새로 만들게 되므로 넣지 않았다. `동대문역사문화공원 → Dongdaemun H&C Park`처럼 `교대`에 짧은 표시형이 생기면 둘 다 들어갈 수 있다.

**남은 진짜 충돌 1건** — `강남고속버스터미널점`/`2호점`은 **주소가 같고**(신반포로 194, B1층/1층) 앞 28자가 같다. 전체 이름으로는 ` 2`로
구별되지만 20자에서는 불가능하다. 규칙 안에 답이 없다 — §7-1의 표시 결정이거나 `강남고속버스터미널`의 짧은 표시형을 오너가 승인해야 한다.

## 7. 남은 작업 (여기서 구현하지 않음)

### 7-0. ⚠ 이 커밋에서 같이 해야 하는 것 — 예산 재고정

`lib/place-name-en.test.ts:19-20`의 래칫이 지금 **깨진다.** `MAX_COLLIDING_AT_20 = 99` → 측정 **104 ❌** / `MAX_COLLIDING_AT_24 = 32` →
측정 **27 ✅**. 오버라이드 계약 테스트 6건은 전부 통과하고, 실패는 20자 예산 하나뿐이며 원인은 §1-1의 산술이다. 둘 중 하나: **(a)** §7-1
표시 결정을 먼저 적용한다 — olive_young @20이 22그룹 → **0**이 되어 래칫이 내려간다(권장). **(b)** 미룬다면 `MAX_COLLIDING_AT_20`을
104로 재고정하고 "체인 워드가 20자 중 12자를 먹는 산술이며 표시 결정으로만 내려간다"를 주석으로 남긴다. `MAX_COLLIDING_AT_24`는 **27로
내린다**(래칫은 내리기만).

### 7-1. 오너 결정 1건 — 목록 행에서 체인 워드 빼기

측정 효과: olive_young @20 **22그룹 → 0그룹**. 브랜드는 이미 `TYPE_ICON`(lib/data.ts:78)과 `BRAND_MARK_SRC`(lib/data.ts:89)가 나른다.
**모든 로마자화 교정을 합친 것보다 가치가 크다.** 단 이것은 `name` 필드가 아니라 **목록 행 표시**의 결정이다 — 878건 전체의 `name`에서
빼면 미용실 등 다른 타입이 오히려 나빠진다(측정: 99 → 123).

### 7-2. 빌더 배선 (아직 안 됨)

오버라이드는 이미 `lib/place-name-en.ts`가 읽고 `lib/data.ts:467`의 `applyEnglishNameOverrides()`가 적용한다. 추가로:

1. **`lib/english-place-name.ts:11`의 `["본점", ""]` → `["본점", " Main"]` 교체. 삭제하면 안 된다** — 삭제하면 다음 줄 `["점",""]`이
   걸려 `노원본점` → `Daiso Nowonbon`이 된다(실측 확인). `…test.ts:10`도 같이 고친다.
2. **두 테이블 모두에** `["사거리점"," Intersection"]`·`오거리점`·`삼거리점`·`네거리점`을 기존 `거리점` **앞에 추가** —
   `lib/english-place-name.ts:5`(Daiso), `scripts/lib/hangul-romanize.mjs:211`(Olive Young). 두 테이블에 사거리 항목이 아예 없으므로 "순서
   변경"이 아니라 **추가**다. `TITLE_SUFFIXES`엔 `본점` 항목이 없어 올리브영 본점 행이 `…bon`으로 렌더된다 — 같이 넣는다.
3. **Daiso 경로**는 long-title-policy §4-3-2대로 스냅샷 `nameEn`을 채우는 편이 낫다. 오버라이드는 `name`만 바꾸므로 `nameVerification`이
   `"provisional"`로 남아, `place-detail-body.tsx:756`의 경고 배지와 `lib/place-audit.ts:128`의 `provisional_english_name` 지적이 검증된
   이름에 계속 붙는다.
4. **올리브영 공식 영문을 `data/sources/`로 스냅샷** 후 P0로 쓴다 — `eventNo`가 폐기될 수 있는 프로모션 페이지이므로 **빌드 시점 라이브
   페치 금지.**
5. **`npm run audit:data` 재실행 후 리포트 커밋** — `scripts/audit-places.ts:37-45`가 리포트를 바이트 비교하고 각 항목에 `name`이 들어
   있어, 268건 개명 후 `npm run audit:data:check`가 실패한다.

### 7-3. 계약 테스트 (설명만)

vitest, `lib/**/*.test.ts`, 소스/데이터 파일을 읽는 기존 패턴. **6건은 이미 `lib/place-name-en.test.ts`에 있고 전부 통과한다** — 존재
확인, 한글 혼입 금지, 실제 적용 확인, 배선 확인, 그리고 결정적으로 **`nameKrAtVerification` 드리프트 검사**(재빌드가 한국어 이름을 옮기면
낡은 영문을 내보내는 대신 실패). 추가로:

- **가독성 게이트** — `lib/place-audit.ts`에 `longestNameToken()` export + `automaticFindings`에 `longestNameToken(place.name) > 18 ?
  ["unreadable_romanized_name"] : []` 한 줄, `scripts/audit-places.ts`에 내리기만 하는 `MAX_UNREADABLE_NAMES` 래칫. **임계 18은
  측정값**(§4-3: 14자는 노이즈 178건+역 10건, 18자는 88건+역 0건). 이번 작업으로 **88 → 33**, 새 베이스라인 33.
- **회귀 문자열 검사** — 확정 오표기(`Cheongryangri`·`Rotde`·`Hompeulreoseu`·`Eebeuridei` …) 재등장 시 실패. 단 `yeok` 검사는 **반드시
  앵커링**할 것 — 단순 부분 문자열 검사는 정상 이름 `Yeoksam`(역삼)과 역 테이블 자체 값을 거부한다. 토큰 길이도 하이픈을 경계로 볼
  것(아니면 `Yeongdeungpo-gu Office`가 걸린다). 검증된 역 영문이 임계를 넘으면(`Sinjeongnegeori` 15자, `Sindaebangsamgeori` 18자) **면제**
  — 아니면 게이트가 리포 자신의 어휘를 거부한다.

### 7-4. 신뢰도 medium 51건

`note`에 `confidence medium`이 적힌 51건은 추정 어휘에 기댄다. 확인 가치 순: **하나로마트/하나로클럽** (hanaromart.co.kr TLS 인증서
불일치, 농협 영문 페이지 404 — 최대 공백), **GS슈퍼 = GS The Fresh**(리브랜딩 후 표기, 구 간판 잔존 가능), **e에브리데이 = Emart
Everyday**, 엔터식스(간판은 enterSIX), 메세나폴리스, 전통시장. 또 `롯데슈퍼범서점`은 **데이터 결함** 의심 — 범서는 서울에 없고 롯데슈퍼
범서점은 울산인데 이 행의 주소는 `서울 은평구 통일로 842 (불광동)`이다. 이름과 주소 중 하나가 상류에서 틀렸다.
