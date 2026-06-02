export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    const preview = text.trim().slice(0, 80);
    throw new Error(buildUnexpectedResponseMessage(String(input), preview));
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMessage =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

function buildUnexpectedResponseMessage(url: string, preview: string) {
  const compactPreview = preview.replace(/\s+/g, ' ');
  if (compactPreview.toLowerCase().startsWith('<!doctype') || compactPreview.startsWith('<html')) {
    return `接口 ${url} 返回了 HTML 页面而不是 JSON。通常是后端没启动，或者你打开的是纯前端页面。请优先使用 http://127.0.0.1:3001 ，或同时启动 npm run server 与 npm run dev。`;
  }
  return `接口 ${url} 返回了非 JSON 内容：${compactPreview || 'empty response'}`;
}
