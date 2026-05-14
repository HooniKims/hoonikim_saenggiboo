# 생기부 작성 도우미(교내용)

한국어 학교생활기록부 문장 생성을 돕는 Next.js 앱입니다. 과세특, 동아리 세특, 행발, 가정통신문 작성 화면을 제공하며, 교내용 빌드는 사용자가 화면에서 적용한 OpenAI API key와 고정 모델 `gpt-5-mini` 경로만 사용합니다.

## 실행

```bash
npm install
npm run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 검증

```bash
npm test
npm run build
```

`npm test`는 `tests/*.test.mjs`의 Node 테스트를 실행합니다. `npm run build`는 `/gwasetuk`, `/club`, `/behavior`, `/letter` 라우트와 API 라우트의 프로덕션 빌드를 확인합니다.

## 주요 구조

- `app/gwasetuk`: 과세특 작성
- `app/club`: 동아리 세특 작성
- `app/behavior`: 행발 작성
- `app/letter`: 가정통신문 작성
- `app/api/openai-generate`: OpenAI 생성 API
- `utils/`: 생성 검증, OpenAI 호출, 글자수/byte 처리, 엑셀 처리 유틸
- `tests/`: 프롬프트, 검증, 라우트 연결, 페이지 parity 회귀 테스트

## 운영 메모

- `.env`나 API key를 커밋하지 않습니다.
- Ollama, LM Studio, NVIDIA, 외부 프록시 문서는 교내용 빌드에서 제거되었습니다.
- 진행 내역과 적용 완료 항목은 `task.md`에 기록합니다.
