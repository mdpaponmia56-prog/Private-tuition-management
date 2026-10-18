export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('tuition_token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    localStorage.removeItem('tuition_token');
    window.location.reload();
    throw new Error('Session expired or unauthorized.');
  }

  // Handle binary / text responses (e.g. CSV download)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    const text = await response.text();
    return text as unknown as T;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred while communicating with the server.');
  }

  return data;
}
