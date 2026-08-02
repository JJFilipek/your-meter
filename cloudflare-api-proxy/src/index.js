export default {
  async fetch(request) {
    const targetUrl = new URL(request.url)
    targetUrl.protocol = 'https:'
    targetUrl.hostname = 'your-meter-api.jfilipek.com'
    targetUrl.port = ''

    return fetch(targetUrl, request)
  },
}
