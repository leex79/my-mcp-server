import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { InferenceClient } from '@huggingface/inference'

// Create server instance
const server = new McpServer({
    name: 'YOUR_SERVER_NAME',
    version: '1.0.0'
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

server.registerTool(
    'calculate',
    {
        description: '두 숫자와 연산자를 입력하면 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)'),
            a: z.number().describe('첫 번째 숫자'),
            b: z.number().describe('두 번째 숫자')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('연산 결과')
                    })
                )
                .describe('연산 결과')
        })
    },
    async ({ operator, a, b }) => {
        let result: number

        if (operator === '+') result = a + b
        else if (operator === '-') result = a - b
        else if (operator === '*') result = a * b
        else {
            if (b === 0) {
                const text = '오류: 0으로 나눌 수 없습니다.'
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }
            result = a / b
        }

        const text = `${a} ${operator} ${b} = ${result}`
        return {
            content: [{ type: 'text' as const, text }],
            structuredContent: { content: [{ type: 'text' as const, text }] }
        }
    }
)

server.registerTool(
    'time',
    {
        description: '현재 날짜와 시간을 반환합니다.',
        inputSchema: z.object({
            timezone: z
                .string()
                .optional()
                .default('Asia/Seoul')
                .describe('타임존 (기본값: Asia/Seoul, 예: UTC, America/New_York)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 날짜/시간')
                    })
                )
                .describe('현재 날짜/시간')
        })
    },
    async ({ timezone }) => {
        const now = new Date()
        const text = now.toLocaleString('ko-KR', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })
        const result = `현재 시각 (${timezone}): ${text}`
        return {
            content: [{ type: 'text' as const, text: result }],
            structuredContent: { content: [{ type: 'text' as const, text: result }] }
        }
    }
)

function describeWeatherCode(code: number): string {
    if (code === 0) return '맑음'
    if (code <= 3) return code === 1 ? '대체로 맑음' : code === 2 ? '구름 조금' : '흐림'
    if (code === 45 || code === 48) return '안개'
    if (code >= 51 && code <= 55) return '이슬비'
    if (code === 56 || code === 57) return '어는 이슬비'
    if (code >= 61 && code <= 65) return '비'
    if (code === 66 || code === 67) return '어는 비'
    if (code >= 71 && code <= 75) return '눈'
    if (code === 77) return '싸락눈'
    if (code >= 80 && code <= 82) return '소나기'
    if (code === 85 || code === 86) return '눈 소나기'
    if (code === 95) return '뇌우'
    if (code === 96 || code === 99) return '우박을 동반한 뇌우'
    return '알 수 없음'
}

function describeWindDirection(degrees: number): string {
    const dirs = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서']
    return dirs[Math.round(degrees / 22.5) % 16]
}

server.registerTool(
    'geocode',
    {
        description: '도시 이름을 입력하면 위도와 경도를 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('도시 이름 (예: Seoul, Tokyo, New York)'),
            language: z
                .string()
                .optional()
                .default('ko')
                .describe('결과 언어 (기본값: ko)'),
            count: z
                .number()
                .int()
                .min(1)
                .max(10)
                .optional()
                .default(1)
                .describe('반환할 결과 수 (기본값: 1, 최대 10)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('좌표 결과')
                    })
                )
                .describe('좌표 결과')
        })
    },
    async ({ name, language, count }) => {
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=${language}&format=json`
            const res = await fetch(url)
            if (!res.ok) {
                const text = `오류: 지오코딩 API 호출 실패 (HTTP ${res.status})`
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }
            const data = (await res.json()) as { results?: Array<{ name: string; country: string; latitude: number; longitude: number; admin1?: string }> }
            if (!data.results || data.results.length === 0) {
                const text = `"${name}"에 해당하는 도시를 찾을 수 없습니다.`
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }
            const lines = data.results.map(r => {
                const region = r.admin1 ? `${r.admin1}, ` : ''
                return `${r.name} (${region}${r.country}) — 위도: ${r.latitude}, 경도: ${r.longitude}`
            })
            const text = lines.join('\n')
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        } catch (e) {
            const text = `오류: 네트워크 요청 실패 — ${e instanceof Error ? e.message : String(e)}`
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        }
    }
)

server.registerTool(
    'weather',
    {
        description: '위도와 경도를 입력하면 현재 날씨 정보를 반환합니다.',
        inputSchema: z.object({
            latitude: z.number().min(-90).max(90).describe('위도 (-90 ~ 90)'),
            longitude: z.number().min(-180).max(180).describe('경도 (-180 ~ 180)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude }) => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`
            const res = await fetch(url)
            if (!res.ok) {
                const text = `오류: 날씨 API 호출 실패 (HTTP ${res.status})`
                return {
                    content: [{ type: 'text' as const, text }],
                    structuredContent: { content: [{ type: 'text' as const, text }] }
                }
            }
            const data = (await res.json()) as {
                current: {
                    temperature_2m: number
                    relative_humidity_2m: number
                    apparent_temperature: number
                    is_day: number
                    weather_code: number
                    wind_speed_10m: number
                    wind_direction_10m: number
                }
            }
            const c = data.current
            const dayNight = c.is_day ? '낮' : '밤'
            const text = [
                `현재 날씨 (위도: ${latitude}, 경도: ${longitude})`,
                `날씨: ${describeWeatherCode(c.weather_code)} (${dayNight})`,
                `기온: ${c.temperature_2m}°C (체감 ${c.apparent_temperature}°C)`,
                `습도: ${c.relative_humidity_2m}%`,
                `풍속: ${c.wind_speed_10m} m/s (${describeWindDirection(c.wind_direction_10m)})`
            ].join('\n')
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        } catch (e) {
            const text = `오류: 네트워크 요청 실패 — ${e instanceof Error ? e.message : String(e)}`
            return {
                content: [{ type: 'text' as const, text }],
                structuredContent: { content: [{ type: 'text' as const, text }] }
            }
        }
    }
)

const SERVER_NAME = 'my-mcp-server'
const SERVER_VERSION = '1.0.0'

server.registerResource(
    'server-info',
    'server://info',
    {
        title: '서버 정보',
        description: 'MCP 서버의 이름, 버전, 등록된 도구 목록 등 서버 메타데이터를 반환합니다.',
        mimeType: 'application/json'
    },
    async (uri) => {
        const info = {
            name: SERVER_NAME,
            version: SERVER_VERSION,
            description: 'Open-Meteo 날씨 및 유틸리티 도구를 제공하는 MCP 서버입니다.',
            tools: [
                {
                    name: 'greet',
                    description: '이름과 언어를 입력하면 인사말을 반환합니다.'
                },
                {
                    name: 'calculate',
                    description: '두 숫자와 연산자를 입력하면 사칙연산 결과를 반환합니다.'
                },
                {
                    name: 'time',
                    description: '현재 날짜와 시간을 반환합니다.'
                },
                {
                    name: 'geocode',
                    description: '도시 이름을 입력하면 위도와 경도를 반환합니다.'
                },
                {
                    name: 'weather',
                    description: '위도와 경도를 입력하면 현재 날씨 정보를 반환합니다.'
                }
            ],
            resources: [
                {
                    uri: 'server://info',
                    description: 'MCP 서버 메타데이터'
                }
            ],
            generatedAt: new Date().toISOString()
        }

        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(info, null, 2),
                    mimeType: 'application/json'
                }
            ]
        }
    }
)

server.registerPrompt(
    'code-review',
    {
        title: '코드 리뷰',
        description: '코드를 입력받아 베스트 프랙틱스에 따라 체계적으로 리뷰합니다.',
        argsSchema: {
            code: z.string().describe('리뷰할 소스 코드'),
            language: z
                .string()
                .optional()
                .describe('프로그래밍 언어 (예: TypeScript, Python, Java)'),
            focus: z
                .enum(['all', 'security', 'performance', 'readability', 'bugs'])
                .optional()
                .default('all')
                .describe('리뷰 집중 영역 (기본값: all)')
        }
    },
    ({ code, language, focus }) => {
        const langLabel = language ? `${language} ` : ''
        const focusGuide: Record<string, string> = {
            all: '버그, 보안, 성능, 가독성, 유지보수성 전반',
            security: '보안 취약점, 인젝션, 인증/인가, 민감 정보 노출',
            performance: '시간/공간 복잡도, 불필요한 연산, 캐싱 기회',
            readability: '네이밍, 주석, 함수 분리, 코드 중복',
            bugs: '잠재적 버그, 예외 처리, 엣지 케이스, 타입 오류'
        }
        const focusText = focusGuide[focus ?? 'all']

        return {
            description: `${langLabel}코드 리뷰 — 집중 영역: ${focusText}`,
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: [
                            `다음 ${langLabel}코드를 전문 시니어 개발자 관점에서 리뷰해주세요.`,
                            `리뷰 집중 영역: **${focusText}**`,
                            '',
                            '## 리뷰 형식',
                            '아래 항목을 순서대로 작성해주세요:',
                            '',
                            '### 1. 요약',
                            '코드의 전반적인 품질과 주요 인상을 2~3문장으로 설명하세요.',
                            '',
                            '### 2. 발견된 문제점',
                            '각 문제를 다음 형식으로 작성하세요:',
                            '- **[심각도: 높음/중간/낮음]** 문제 설명',
                            '  - 위치: 해당 라인 또는 함수명',
                            '  - 이유: 왜 문제인지',
                            '  - 개선 방법: 구체적인 수정 제안 (코드 예시 포함)',
                            '',
                            '### 3. 잘된 점',
                            '코드에서 좋은 패턴이나 관행이 있다면 언급하세요.',
                            '',
                            '### 4. 개선된 전체 코드 (선택)',
                            '변경 사항이 많다면 개선된 전체 코드를 제공하세요.',
                            '',
                            '---',
                            '',
                            '```' + (language?.toLowerCase() ?? ''),
                            code,
                            '```'
                        ].join('\n')
                    }
                },
                {
                    role: 'assistant' as const,
                    content: {
                        type: 'text' as const,
                        text: `코드를 분석하겠습니다. ${focusText} 관점에서 체계적으로 리뷰를 시작합니다.`
                    }
                }
            ]
        }
    }
)

server.registerTool(
    'generate-image',
    {
        description: 'HuggingFace FLUX.1-schnell 모델로 텍스트 프롬프트에서 이미지를 생성합니다.',
        inputSchema: z.object({
            prompt: z.string().describe('이미지 생성 프롬프트'),
            num_inference_steps: z
                .number()
                .int()
                .min(1)
                .max(10)
                .optional()
                .default(4)
                .describe('추론 스텝 수 (1~10, 기본값 4)')
        })
    },
    async ({ prompt, num_inference_steps }) => {
        if (!process.env.HF_TOKEN) {
            const text = '오류: HF_TOKEN 환경 변수가 설정되지 않았습니다.'
            return { content: [{ type: 'text' as const, text }] }
        }
        try {
            const client = new InferenceClient(process.env.HF_TOKEN)
            const blob = await client.textToImage(
                {
                    provider: 'together',
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: prompt,
                    parameters: { num_inference_steps }
                },
                { outputType: 'blob' }
            )
            const data = Buffer.from(await blob.arrayBuffer()).toString('base64')
            return {
                content: [{
                    type: 'image' as const,
                    data,
                    mimeType: blob.type || 'image/png'
                }]
            }
        } catch (e) {
            const text = `오류: 이미지 생성 실패 — ${e instanceof Error ? e.message : String(e)}`
            return { content: [{ type: 'text' as const, text }] }
        }
    }
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        console.log('MCP server started')
    })
