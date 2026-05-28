# my-mcp-server

Next.js + `mcp-handler` 기반 MCP 서버입니다. Vercel에 배포하거나 로컬에서 실행할 수 있습니다.

## 제공 기능

### Tools
| 도구 | 설명 |
|---|---|
| `greet` | 이름과 언어를 입력하면 인사말 반환 |
| `calculate` | 두 숫자와 연산자로 사칙연산 수행 |
| `time` | 타임존별 현재 날짜/시간 반환 |
| `geocode` | 도시 이름 → 위도/경도 변환 (Open-Meteo) |
| `weather` | 위도/경도 → 현재 날씨 정보 (Open-Meteo) |
| `generate-image` | FLUX.1-schnell로 텍스트→이미지 생성 (x-hf-token 헤더 필요) |

### Resources
| URI | 설명 |
|---|---|
| `server://info` | 서버 메타데이터 (도구 목록, 버전 등) |

### Prompts
| 프롬프트 | 설명 |
|---|---|
| `code-review` | 코드를 입력받아 베스트 프랙틱스에 따라 체계적으로 리뷰 |

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 로컬 개발 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.
MCP 엔드포인트: `http://localhost:3000/mcp`

### 3. 빌드

```bash
npm run build
npm start
```

## MCP 클라이언트 설정

### Cursor (HTTP Transport)

`.cursor/mcp.json` 또는 Cursor 설정에 추가:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "x-hf-token": "hf_YOUR_HUGGINGFACE_TOKEN"
      }
    }
  }
}
```

`x-hf-token`은 `generate-image` 도구 사용 시에만 필요합니다. HuggingFace 토큰은 [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)에서 발급받을 수 있습니다.

### Vercel 배포 후

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "url": "https://your-app.vercel.app/mcp",
      "headers": {
        "x-hf-token": "hf_YOUR_HUGGINGFACE_TOKEN"
      }
    }
  }
}
```

## Vercel 배포

### GitHub 연동 (권장)

1. [Vercel 대시보드](https://vercel.com/new)에서 이 저장소를 import
2. 별도 환경 변수 설정 불필요 (`HF_TOKEN`은 클라이언트 헤더로 전달)
3. 배포 완료 후 `https://your-app.vercel.app/mcp` 로 접근

### Vercel CLI

```bash
npm install -g vercel
vercel
```

## 프로젝트 구조

```
├── app/
│   └── [transport]/
│       └── route.ts       # MCP 핸들러 (모든 도구/리소스/프롬프트 정의)
├── src/
│   └── index.ts           # 레거시 stdio 서버 (참고용)
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## 기술 스택

- [Next.js 15](https://nextjs.org/) — App Router
- [mcp-handler 1.1.0](https://github.com/vercel/mcp-handler) — MCP HTTP 어댑터
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP SDK
- [@huggingface/inference](https://github.com/huggingface/huggingface.js) — HuggingFace Inference API
- [Open-Meteo](https://open-meteo.com/) — 무료 날씨/지오코딩 API (키 불필요)
