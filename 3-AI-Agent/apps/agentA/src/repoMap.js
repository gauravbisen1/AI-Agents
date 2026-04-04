const repoMap = [
  { keyword: 'auth', repo: 'auth-service' },
  { keyword: 'payment', repo: 'payment-service' },
  { keyword: 'frontend', repo: 'web-app' }
];

export function mapToRepo({ repoHint, message, stackTrace }) {
  if (repoHint) return repoHint;

  const haystack = `${message || ''}\n${stackTrace || ''}`.toLowerCase();
  const found = repoMap.find((entry) => haystack.includes(entry.keyword));
  return found?.repo || process.env.GITHUB_DEFAULT_REPO || 'unknown-repo';
}
