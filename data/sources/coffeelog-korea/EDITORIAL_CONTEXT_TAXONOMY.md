# 카페 편집 맥락 분류 체계

이 문서는 `@coffeelog_korea`가 카페를 소개하는 방식인 **상황·공간·계절·동네**를 My Seoul Drop과 A Drop of Seoul에서 재사용하기 위한 데이터 규칙이다.

핵심 원칙은 장소의 객관적 속성과 원문 게시물의 편집 관점을 구분하는 것이다. 예를 들어 `통창`은 현장 검증이 필요한 공간 속성이고, `하늘이 예쁜 날 가기 좋은 곳`은 원문 컬렉션의 관점이다. 현재 태그는 모두 원문 제목에서 파생한 `source_derived` 정보이며 서비스 자체 추천을 의미하지 않는다.

## ID 규칙

컬렉션 ID 형식:

`coffeelog-korea:<stable-kebab-slug>`

예시:

- `coffeelog-korea:sky-view-cafes`
- `coffeelog-korea:weekend-work-cafes`
- `coffeelog-korea:seongsu-coffee-walk`
- `coffeelog-korea:hannam-afternoon-cafes`

한 번 배포한 ID는 제목이 바뀌어도 재사용한다. 같은 주제의 후속 게시물이 나오면 기존 컬렉션에 출처 게시물을 추가할지, 별도 컬렉션으로 만들지 편집자가 판단한다.

## 장소 레코드 필드

| 필드 | 의미 | 예시 |
|---|---|---|
| `source_collection_ids` | 장소가 등장한 원문 묶음 | `["coffeelog-korea:weekend-work-cafes"]` |
| `occasion_tags` | 방문 상황과 목적 | `work`, `study`, `solo-time`, `date` |
| `space_tags` | 공간 성격 | `large-window`, `view`, `long-stay` |
| `season_tags` | 계절·날씨 맥락 | `spring`, `summer`, `rainy-day`, `good-weather` |
| `food_drink_tags` | 메뉴·음료 맥락 | `coffee`, `latte`, `matcha`, `dessert` |
| `neighborhood_tags` | 동네 탐색 키 | `seongsu`, `hannam`, `mangwon` |
| `editorial_context_status` | 분류 상태 | `source_derived`, `reviewed`, `unclassified` |
| `editorial_context_provenance` | 태그 근거 | `threads_collection_title` |

## 태그 축

### `occasion_tags`

- `work`: 노트북 작업 목적
- `study`: 공부·읽기 목적
- `solo-time`: 혼자 머무는 상황
- `date`: 둘이 방문하는 상황
- `slow-afternoon`: 느긋하게 머무는 오후
- `afternoon`: 오후 동선
- `neighborhood-walk`: 동네 산책·코스의 한 지점
- `good-weather`: 맑거나 날씨가 좋은 날의 맥락

### `space_tags`

- `large-window`: 통창이 강조된 공간
- `view`: 외부 풍경이나 전망이 강조된 공간
- `long-stay`: 오래 머무는 용도로 소개된 공간

### `season_tags`

`spring`, `summer`, `autumn`, `winter`, `rainy-day`처럼 명확히 언급된 경우만 넣는다. `good-weather`는 계절이 아니라 상황이므로 `occasion_tags`에 둔다.

### `food_drink_tags`

원문에서 메뉴나 음료가 컬렉션의 핵심일 때만 사용한다. 카페라는 이유만으로 모든 레코드에 `coffee`를 자동 부여하지 않는다.

### `neighborhood_tags`

영문 소문자 kebab-case를 사용한다. 행정구가 아니라 독자가 인식하는 동네 단위다. 위치가 검증되기 전에는 주소만 보고 추론하지 않는다.

## 컬렉션과 장소의 관계

- 한 장소는 여러 컬렉션에 포함될 수 있다.
- `source_collection_ids`는 원문 포함 관계를 보존한다.
- 태그는 해당 컬렉션의 맥락을 장소 레코드에 투영한 값이다.
- 현장 검증 후 객관적 속성으로 확정된 태그는 별도 운영 필드로 승격하는 것이 안전하다.
- ADoS에서 보여줄 컬렉션 제목과 설명은 원문을 그대로 복제하지 않고 독자와 동선에 맞춰 다시 편집한다.

## 공개 전 확인

1. 동일 지점인지 확인한다.
2. 주소와 좌표, 현재 영업 여부를 확인한다.
3. 카페가 아닌 베이커리·책방·판매점 여부를 확인한다.
4. `space_tags`는 사진 또는 공식 정보로 다시 확인한다.
5. ADoS 또는 My Seoul Drop의 추천으로 공개하려면 자체 선정 이유를 별도로 작성한다.

현재 분류된 30개 외의 후보는 `unclassified`로 유지한다. 원문 게시물과 장소 묶음을 다시 대조하기 전에는 이름이나 주소만 보고 태그를 추측하지 않는다.
