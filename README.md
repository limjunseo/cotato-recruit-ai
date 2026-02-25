# Club Recruitment Admin Dashboard (MVP)

Next.js App Router 기반의 내부 운영용 대시보드입니다.
운영 RDS에서 배치로 데이터를 받아 로컬 MySQL에 저장한 뒤, 로컬 DB 기준으로 지원서를 조회/노션 동기화합니다.

## 핵심 기능

- 지원서 목록 조회 + 다중 필터
- 지원서 상세 조회
- AI 면접 질문 생성 (LLM provider 선택: local 또는 Gemini)
- 지원서 상세에서 AI 질문 생성 후 노션 전송
- 운영 RDS -> 로컬 DB 배치 동기화 (`application_id` 기준 신규 insert)
- 대시보드에서 `Prod RDS Pull` 수동 실행 버튼
- 30분 주기 자동 크론 동기화 (`GET /api/rds-sync`)
- 노션 이관 전 검토 단계에 맞춘 MVP 구조

## 기술 스택

- Next.js (App Router)
- Prisma + MySQL
- Tailwind CSS
- Framer Motion
- Lucide React

## 1) 설치

```bash
npm install
```

## 2) 환경 변수

`.env.example`를 참고해 `.env`를 생성하세요.

```bash
cp .env.example .env
```

필수:

- `DATABASE_URL` (로컬 MySQL `recruitment_to_notion`)
- `SOURCE_DATABASE_URL` (운영 RDS MySQL)

선택:

- `LLM_PROVIDER` (`local` 또는 `gemini`, 기본 `local`)
- `LOCAL_LLM_ENDPOINT` (기본값: `http://127.0.0.1:11434/v1`)
- `LOCAL_LLM_MODEL` (기본값: `gemma3:12b`)
- `LOCAL_LLM_API_KEY` (기본값: `ollama`)
- `LOCAL_LLM_USE_OPENCLAW` (`true`면 OpenClaw CLI 우선 사용, 기본 `false`)
- `OPENCLAW_WSL_BIN` (Windows에서 WSL OpenClaw 절대경로 지정 시 사용, 예: `/home/ubuntu/.npm-global/bin/openclaw`)
- `OPENCLAW_AGENT_ID` (OpenClaw `agent` 실행 시 사용할 agent id, 기본 `main`)
- `GEMINI_API_KEY` (`LLM_PROVIDER=gemini`일 때 필수)
- `GEMINI_MODEL` (기본값: `gemini-2.0-flash`)
- `GEMINI_API_ENDPOINT` (기본값: `https://generativelanguage.googleapis.com/v1beta`)
- `INTERVIEW_AVAILABILITY_USE_LLM_NORMALIZER` (`true/false`, 기본 `true`)
- `NOTION_TOKEN`
- 서류/지원서 노션 DB: `NOTION_DATABASE_ID_BE|DE|FE|PM`
- 면접시간 Sync 노션 DB: `NOTION_INTERVIEW_DATABASE_ID_BE|DE|FE|PM`
- `CRON_SECRET` (`GET /api/rds-sync` 보호용, 설정 시 Bearer 인증 필요)

예시:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@127.0.0.1:3306/recruitment_to_notion?connection_limit=5"
SOURCE_DATABASE_URL="mysql://readonly:YOUR_PASSWORD@YOUR_RDS_HOST:3306/recruitment?connection_limit=5"
RDS_SYNC_BATCH_SIZE="200"
RDS_SYNC_MAX_BATCHES="0"
RDS_SYNC_START_AFTER_ID="0"
CRON_SECRET=""
LLM_PROVIDER="local"
LOCAL_LLM_ENDPOINT="http://127.0.0.1:11434/v1"
LOCAL_LLM_MODEL="gemma3:12b"
LOCAL_LLM_API_KEY="ollama"
LOCAL_LLM_USE_OPENCLAW="false"
OPENCLAW_WSL_BIN=""
OPENCLAW_AGENT_ID="main"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.0-flash"
GEMINI_API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta"
NOTION_TOKEN=""
NOTION_DATABASE_ID_BE=""
NOTION_DATABASE_ID_DE=""
NOTION_DATABASE_ID_FE=""
NOTION_DATABASE_ID_PM=""
NOTION_INTERVIEW_DATABASE_ID_BE=""
NOTION_INTERVIEW_DATABASE_ID_DE=""
NOTION_INTERVIEW_DATABASE_ID_FE=""
NOTION_INTERVIEW_DATABASE_ID_PM=""
```

## 3) Prisma Client 생성

```bash
npm run db:generate
```

로컬 DB `applications` 테이블에 아래 컬럼이 없다면 먼저 추가하세요.

```sql
ALTER TABLE applications
  ADD COLUMN unavailable_interview_times TEXT NULL,
  ADD COLUMN is_synced_to_notion BOOLEAN NOT NULL DEFAULT 0,
  ADD COLUMN notion_synced_at DATETIME(6) NULL;
```

## 4) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3011` 접속 시 `/applications`로 이동합니다.

## 운영 RDS -> 로컬 DB 배치 동기화

```bash
npm run db:sync:rds:applications
npm run db:sync:rds:questions
npm run db:sync:rds:answers
# 또는 전체 순차 실행
npm run db:sync:rds
```

동작:
- `db:sync:rds:applications`: 제출된 지원서(`is_submitted=true`)를 읽어 신규 `applications` insert + `application_etc_infos.etc_data.unavailableInterviewTimes`를 `applications.unavailable_interview_times`로 동기화
- `db:sync:rds:questions`: 로컬 `applications` 기준으로 필요한 `questions`(question content 포함) insert
- `db:sync:rds:answers`: 로컬 `applications` 기준으로 필요한 `application_answers`(answer content 포함) insert
- `db:sync:rds`: 위 3개를 순서대로 실행
- 신규 지원서는 `is_synced_to_notion=false`, `notion_synced_at=null`로 저장
- UI에서 `Prod RDS Pull` 버튼으로 동일 동작을 수동 실행 가능

자동 크론:
- `vercel.json`에 `*/30 * * * *`로 `/api/rds-sync` 등록
- `GET /api/rds-sync`는 `CRON_SECRET`이 설정되어 있으면 `Authorization: Bearer <CRON_SECRET>` 필요

`applications`는 노션 동기화에 필요한 최소 컬럼만 조회/저장합니다.
- `application_id`, `generation_id`, `user_id`, `name`
- `birth_date`, `phone_number`, `university`, `major`, `gender`
- `application_part_type`, `pass_status`
- `is_submitted`, `submitted_at`

## 사용 API

- `GET /api/applications`
- `GET /api/applications/:id`
- `POST /api/applications/:id/interview-questions`
- `POST /api/applications/:id/notion`
- `POST /api/rds-sync` (수동 트리거)
- `GET /api/rds-sync` (크론 트리거)

## 필터 파라미터 (`GET /api/applications`)

- `q`: 이름/전공/학교/연락처 검색
- `part`: `BE | DE | FE | PM | ALL`
- `passStatus`: `FAIL | PASS | PENDING | WAITLISTED | ALL`
- `submitted`: `all | yes | no`
- `enrolled`: `all | yes | no`
- `prevActivity`: `all | yes | no`
- `generationId`: 숫자 문자열
- `submittedFrom`: `YYYY-MM-DD`
- `submittedTo`: `YYYY-MM-DD`
- `page`: 기본 1
- `pageSize`: 기본 10 (최대 100)

## 데이터 스키마 정책

Prisma 모델은 아래 컬럼만 사용합니다.

- `application_id`
- `application_part_type`
- `birth_date`
- `completed_semesters`
- `gender`
- `is_enrolled`
- `is_prev_activity`
- `is_submitted`
- `major`
- `name`
- `pass_status`
- `pdf_file_key`
- `pdf_file_url`
- `unavailable_interview_times`
- `phone_number`
- `submitted_at`
- `university`
- `generation_id`
- `user_id`
- `is_synced_to_notion`
- `notion_synced_at`

## 유틸 스크립트

```bash
npm run db:generate
npm run db:pull
npm run db:studio
npm run db:sync:rds:applications
npm run db:sync:rds:questions
npm run db:sync:rds:answers
npm run db:sync:rds
```

