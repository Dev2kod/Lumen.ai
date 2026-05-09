async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  setKey: (key) =>
    request('/auth/me/key', { method: 'PUT', body: { key } }),
  removeKey: () => request('/auth/me/key', { method: 'DELETE' }),

  // Sources / generation
  listSources: () => request('/sources').then((d) => d.sources),
  getSource: (id) => request(`/sources/${id}`),
  createSource: (payload) =>
    request('/sources', { method: 'POST', body: payload }).then((d) => d.source),
  deleteSource: (id) => request(`/sources/${id}`, { method: 'DELETE' }),
  generateLearning: (id) =>
    request(`/sources/${id}/learning`, { method: 'POST' }),
  generateRepurpose: (id, format, angle) =>
    request(`/sources/${id}/repurpose`, {
      method: 'POST',
      body: { format, angle },
    }).then((d) => d.repurpose),
  askQuestion: (id, question) =>
    request(`/sources/${id}/ask`, {
      method: 'POST',
      body: { question },
    }).then((d) => d.chat),
  toggleStarChat: (id, chatId) =>
    request(`/sources/${id}/chats/${chatId}/star`, { method: 'PATCH' }).then(
      (d) => d.chat
    ),
  deleteChat: (id, chatId) =>
    request(`/sources/${id}/chats/${chatId}`, { method: 'DELETE' }),
  regenerateFlashcards: (id, topic) =>
    request(`/sources/${id}/flashcards`, {
      method: 'POST',
      body: { topic },
    }).then((d) => d.learning),
};
