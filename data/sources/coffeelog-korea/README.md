# coffeelog_korea 카페 후보 전달 자료

출처: https://www.threads.com/@coffeelog_korea

2026-09-22에 Threads 게시물 510개(게시일 2025-03-14~2026-09-21)를 확인해 만든 후보 백업이다. 운영 장소 데이터가 아니며 자동 게시하거나 기존 장소 ID를 바로 발급하면 안 된다.

## 파일

- `seoul-cafe-candidates-2026-09-22.json`: My Seoul Drop staging import용 서울 후보 454개. 30개만 주소·영문 지역·주제·원문 게시물 URL이 보강되어 있다.
- `collections-2026-09-22.json`: 원문 게시물의 상황·공간·동네 관점을 보존한 컬렉션 4개와 멤버 후보 ID.
- `EDITORIAL_CONTEXT_TAXONOMY.md`: 컬렉션 ID와 상황·공간·계절·메뉴·동네 태그 규칙.
- `research-labels-2026-09-26.json`: 외부 출처로 검증한 장소 속성, ADoS 편집 각도, 근거 URL.
- `research-queue-2026-09-26.json`: 454개 전체 후보의 정규화 이름, 중복 가능성, 업종 검토 및 조사 우선순위.
- `editorial-series-2026-10-15.json`: 검증된 정규 장소를 상황 중심의 ADoS 글 8편으로 묶은 개발용 초안 매니페스트.
- `EDITORIAL_SERIES_ROADMAP.md`: 시리즈 발행 순서, 화면 적용 방식, 공개 전 안전장치.
- `editorial-drafts/`: 우선순위 1~3 시리즈의 한국어 아티클 초안.
- `EDITORIAL_IMAGE_BRIEFS.md`: 우선순위 1~3 시리즈의 대표 이미지 방향과 금지 요소.
- `publication-checklist-priority-1-3.json`: 18개 장소의 발행 직전 재확인 범위와 원고 연결 정보.
- `seoul-names-raw.md`: 서울 21개 자치구별 원문 이름 목록.
- `outside-seoul-raw.md`: 경기·부산·제주 등 서울 이외 장소의 원문 기반 백업. 현재 import 대상은 아니다.

## import 규칙

1. JSON의 `external_id`는 후보 전달용 키이며 My Seoul Drop의 정식 장소 ID가 아니다.
2. 기존 장소와 이름·주소·지점을 대조한다. 이름만 같다는 이유로 병합하지 않는다.
3. `candidate_unverified`는 검색·지도·추천 목록에 공개하지 않는다.
4. 주소, 좌표, 현재 영업 여부, 장소 유형을 확인한 뒤 정식 ID를 발급한다.
5. 확인 완료 전 `eligible_for_ados`와 `eligible_for_my_seoul_drop`을 `false`로 유지한다.
6. Threads 계정은 발견 출처다. My Seoul Drop 자체 리뷰나 추천 근거로 표시하지 않는다.
7. `source_collection_ids`와 다축 태그는 원문 게시물의 편집 맥락이다. 현장 검증된 장소 속성으로 간주하지 않는다.
8. `research_status`와 `verified_attributes`는 외부 조사 결과이며, `eligible_for_ados`와 별개다.
9. `editorial-series-2026-10-15.json`은 글 기획 초안이다. 포함 여부만으로 장소 추천 승인이나 공개 권한을 부여하지 않는다.

권장 검토 상태:

`candidate_unverified` → `identity_matched` → `details_verified` → `approved`

중복·폐업·카페가 아닌 장소는 각각 `duplicate`, `closed`, `out_of_scope`로 보류한다.

## 데이터 한계

- 원문 표기 454개는 고유 매장 454곳을 뜻하지 않는다. 지점명·괄호·메뉴명이 붙은 변형이 있다.
- 베이커리·책방·붕어빵 가게 등이 섞여 있다.
- 주소가 없는 후보가 많고, 이미지 안에서만 확인 가능한 장소는 누락될 수 있다.
- 서울 이외 자료는 본문 텍스트에서 확인된 후보만 포함한다.
