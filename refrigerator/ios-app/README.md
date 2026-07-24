# 냉장고 프로젝트 → iOS 앱 (TestFlight) 만들기 가이드

이 폴더는 배포된 웹앱(`https://app-eight-amber-63.vercel.app`)을
**iOS 앱으로 감싸(WKWebView 래퍼) TestFlight로 테스트**하기 위한 자료입니다.

- 웹을 배포하면 앱도 자동으로 최신 상태가 됩니다(앱 재빌드 불필요).
- 포함 파일: `FridgeApp.swift`, `ContentView.swift`, `AppIcon-1024.png`

> ⚠️ 이 Mac에는 현재 **Xcode가 없습니다**(명령줄 도구만 있음). 아래 0단계부터 진행하세요.

---

## 준비물 (한 번만)

| 항목 | 방법 | 비고 |
|------|------|------|
| **Xcode** | Mac App Store에서 "Xcode" 설치 | 용량 큼(수 GB), 시간 걸림 — 지금 시작 |
| **Apple Developer Program** | developer.apple.com/programs → Enroll | **연 $99**, 승인에 몇 시간~2일 |
| **Apple ID** | 기존 것 사용 가능 (saewooland@gmail.com) | 개발자 가입에 사용 |

Xcode 설치와 개발자 가입은 **동시에 시작**해두면 대기시간이 겹칩니다.

---

## 1단계 — Xcode에서 새 프로젝트 만들기

1. Xcode 실행 → **File ▸ New ▸ Project…**
2. **iOS ▸ App** 선택 → Next
3. 입력:
   - **Product Name**: `냉장고` (또는 `Fridge`)
   - **Team**: 개발자 계정 로그인 후 선택 (아래 3단계에서)
   - **Organization Identifier**: `com.wooyagi` (원하는 값)
   - → **Bundle Identifier**가 `com.wooyagi.냉장고`처럼 자동 생성됨 (기억해두기)
   - **Interface**: **SwiftUI**
   - **Language**: **Swift**
   - Storage/Testing 옵션은 기본값
4. 저장 위치 선택 → Create

## 2단계 — 소스 코드 교체 (2개 파일)

Xcode가 만든 기본 파일을 이 폴더의 것으로 바꿉니다.

1. 왼쪽 파일 목록에서 자동 생성된 **`(프로젝트명)App.swift`** 를 열고,
   내용을 이 폴더의 **`FridgeApp.swift`** 내용으로 통째로 교체.
   - `@main struct FridgeApp`의 이름은 파일명과 달라도 됩니다. 만약 빌드 에러가 나면
     원래 파일의 `struct 이름`을 그대로 두고, 그 안 `body`만 `ContentView()` 부분으로 맞추세요.
2. **`ContentView.swift`** 를 열고, 이 폴더의 **`ContentView.swift`** 내용으로 통째로 교체.
   - 맨 위 `kAppURL` 이 우리 앱 주소인지 확인:
     `https://app-eight-amber-63.vercel.app`

## 3단계 — 서명(Signing) 설정

1. 왼쪽 맨 위 파란 **프로젝트 아이콘** 클릭 → **TARGETS ▸ (앱)** 선택
2. **Signing & Capabilities** 탭
3. **Automatically manage signing** 체크
4. **Team**: 본인 개발자 팀 선택 (개발자 가입/로그인 필요)
   - Xcode ▸ Settings ▸ Accounts 에서 Apple ID 추가해두면 여기 나타남
5. 서명 오류가 사라지면 OK

## 4단계 — 앱 아이콘 & 카메라 권한

**아이콘**
1. 왼쪽에서 **Assets** (Assets.xcassets) 열기 → **AppIcon** 선택
2. 이 폴더의 **`AppIcon-1024.png`** 를 **가장 큰 1024 슬롯**(또는 "Single Size" 칸)에 드래그
   - Xcode 15+는 1024 하나만 넣으면 나머지 크기를 자동 처리합니다.

**카메라/사진 권한** (재료 사진·바코드 기능용) — 안 넣으면 카메라 사용 시 앱이 꺼질 수 있음
1. TARGETS ▸ (앱) ▸ **Info** 탭 → 아래 두 키 추가 (＋ 버튼):
   - `Privacy - Camera Usage Description` → 값: `재료 사진과 바코드 촬영에 사용해요`
   - `Privacy - Photo Library Usage Description` → 값: `재료 사진을 고를 때 사용해요`

## 5단계 — 실기기에서 먼저 확인 (선택, 권장)

1. 아이폰을 케이블로 연결 → Xcode 상단 기기 선택에서 내 아이폰 선택
2. ▶︎ (Run) → 앱이 폰에 설치되어 웹앱이 뜨는지 확인
   - "신뢰할 수 없는 개발자" 뜨면: 아이폰 ▸ 설정 ▸ 일반 ▸ VPN 및 기기 관리 ▸ 개발자 앱 ▸ 신뢰

## 6단계 — 아카이브 & App Store Connect 업로드

1. Xcode 상단 기기 선택을 **Any iOS Device (arm64)** 로 변경
   (시뮬레이터가 선택돼 있으면 Archive가 비활성화됨)
2. **Product ▸ Archive** → 빌드 완료되면 Organizer 창이 뜸
3. **Distribute App ▸ TestFlight & App Store**(또는 App Store Connect) ▸ Upload
4. 서명은 자동으로 두고 진행 → 업로드 완료

> 처음이면 App Store Connect(appstoreconnect.apple.com)에서 **새 앱 등록**이 필요할 수 있어요:
> My Apps ▸ ＋ ▸ New App → 이름/번들ID/SKU 입력. Bundle ID는 3단계 것과 동일하게.

## 7단계 — TestFlight로 초대

1. **appstoreconnect.apple.com** ▸ 내 앱 ▸ **TestFlight** 탭
2. 업로드한 빌드가 "처리 중"에서 준비 완료로 바뀌길 대기(몇 분~30분)
3. **내부 테스트(Internal Testing)**:
   - 테스터(본인·가족의 Apple ID 이메일) 추가 → **심사 없이 바로** 설치 가능 (최대 100명)
4. 테스터는 폰에 **TestFlight 앱**(App Store에서 무료 설치) 후 초대 메일의 링크로 설치
5. 외부 테스터(최대 1만명)를 쓰려면 간단한 **Beta App Review**가 한 번 필요

---

## 자주 겪는 문제

- **Archive 메뉴가 회색** → 기기를 "Any iOS Device"로 바꾸세요(시뮬레이터 X).
- **서명 오류(no team)** → 개발자 가입 승인 후 Xcode ▸ Settings ▸ Accounts에 Apple ID 추가.
- **빈 흰 화면** → `kAppURL` 오타 확인, 인터넷 연결 확인.
- **웹뷰만 감싼 앱이라 App Store 정식 출시는 거절될 수 있음** → 하지만 **TestFlight 내부 테스트는 문제없음**. 정식 출시를 원하면 알림/공유 등 네이티브 기능 추가가 필요하며, 별도로 도와드릴 수 있어요.

## 업데이트 방법
- 웹 내용(디자인·기능)은 **평소처럼 커밋만 하면** 앱에도 자동 반영됩니다(웹뷰가 라이브 URL을 봄).
- 앱 아이콘/이름/네이티브 동작을 바꿀 때만 Xcode에서 다시 Archive → 업로드 하세요.
