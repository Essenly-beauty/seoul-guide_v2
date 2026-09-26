# coffeelog_korea 카페 후보 전달 자료

출처: https://www.threads.com/@coffeelog_korea

2026-09-22에 Threads 게시물 510개(게시일 2025-03-14~2026-09-21)를 확인해 만든 후보 백업이다. 운영 장소 데이터가 아니며 자동 게시하거나 기존 장소 ID를 바로 발급하면 안 된다.

## 파일

- `seoul-cafe-candidates-2026-09-22.json`: My Seoul Drop staging import용 서울 후보 454개. 30개만 주소·영문 지역·주제·원문 게시물 URL이 보강되어 있다.
- `seoul-names-raw.md`: 서울 21개 자치구별 원문 이름 목록.
- `outside-seoul-raw.md`: 경기·부산·제주 등 서울 이외 장소의 원문 기반 백업. 현재 import 대상은 아니다.

## import 규칙

1. JSON의 `external_id`는 후보 전달용 키이며 My Seoul Drop의 정식 장소 ID가 아니다.
2. 기존 장소와 이름·주소·지점을 대조한다. 이름만 같다는 이유로 병합하지 않는다.
3. `candidate_unverified`는 검색·지도·추천 목록에 공개하지 않는다.
4. 주소, 좌표, 현재 영업 여부, 장소 유형을 확인한 뒤 정식 ID를 발급한다.
5. 확인 완료 전 `eligible_for_ados`와 `eligible_for_my_seoul_drop`을 `false`로 유지한다.
6. Threads 계정은 발견 출처다. My Seoul Drop 자체 리뷰나 추천 근거로 표시하지 않는다.

권장 검토 상태:

`candidate_unverified` → `identity_matched` → `details_verified` → `approved`

중복·폐업·카페가 아닌 장소는 각각 `duplicate`, `closed`, `out_of_scope`로 보류한다.

## 데이터 한계

- 원문 표기 454개는 고유 매장 454곳을 뜻하지 않는다. 지점명·괄호·메뉴명이 붙은 변형이 있다.
- 베이커리·책방·붕어빵 가게 등이 섞여 있다.
- 주소가 없는 후보가 많고, 이미지 안에서만 확인 가능한 장소는 누락될 수 있다.
- 서울 이외 자료는 본문 텍스트에서 확인된 후보만 포함한다.
