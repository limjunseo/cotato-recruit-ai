# Club Recruitment Admin Dashboard (MVP)

Next.js App Router 기반의 내부 운영용 대시보드입니다.
로컬에서 실행하며 MySQL의 `applications` 테이블을 조회합니다.

## 핵심 기능

- 지원서 목록 조회 + 다중 필터
- 지원서 상세 조회
- AI 면접 질문 생성 (LLM provider 선택: local 또는 Gemini)
- 지원서 상세에서 AI 질문 생성 후 노션 전송
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

- `DATABASE_URL` (예: 로컬 MySQL `recruitment_to_notion`)

선택:

- `LLM_PROVIDER` (`local` 또는 `gemini`, 기본 `local`)
- `LOCAL_LLM_ENDPOINT` (기본값: `http://127.0.0.1:11434/v1`)
- `LOCAL_LLM_MODEL` (기본값: `gemma3:12b`)
- `LOCAL_LLM_API_KEY` (기본값: `ollama`)
- `GEMINI_API_KEY` (`LLM_PROVIDER=gemini`일 때 필수)
- `GEMINI_MODEL` (기본값: `gemini-2.0-flash`)
- `GEMINI_API_ENDPOINT` (기본값: `https://generativelanguage.googleapis.com/v1beta`)
- `NOTION_TOKEN`
- `NOTION_DATABASE_ID_BE` (백엔드)
- `NOTION_DATABASE_ID_DE` (디자인)
- `NOTION_DATABASE_ID_FE` (프론트)
- `NOTION_DATABASE_ID_PM` (기획)

예시:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@127.0.0.1:3306/recruitment_to_notion?connection_limit=5"
LLM_PROVIDER="local"
LOCAL_LLM_ENDPOINT="http://127.0.0.1:11434/v1"
LOCAL_LLM_MODEL="gemma3:12b"
LOCAL_LLM_API_KEY="ollama"
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.0-flash"
GEMINI_API_ENDPOINT="https://generativelanguage.googleapis.com/v1beta"
NOTION_TOKEN=""
NOTION_DATABASE_ID_BE=""
NOTION_DATABASE_ID_DE=""
NOTION_DATABASE_ID_FE=""
NOTION_DATABASE_ID_PM=""
```

## 3) Prisma Client 생성

```bash
npm run db:generate
```

## 4) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3011` 접속 시 `/applications`로 이동합니다.

## 사용 API

- `GET /api/applications`
- `GET /api/applications/:id`
- `POST /api/applications/:id/interview-questions`
- `POST /api/applications/:id/notion`

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
- `phone_number`
- `submitted_at`
- `university`
- `generation_id`
- `user_id`

## 유틸 스크립트

```bash
npm run db:generate
npm run db:pull
npm run db:studio
```

