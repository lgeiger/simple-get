module.exports = simpleGet

var http = require('http')
var https = require('https')
var once = require('once')
var url = require('url')
var unzipResponse = require('unzip-response')

function simpleGet (opts, cb) {
  if (typeof opts === 'string') opts = { url: opts }
  cb = once(cb)

  // Follow redirects
  if (opts.maxRedirects === 0) {
    cb(new Error('too many redirects'))
    return
  }
  if (!opts.maxRedirects) opts.maxRedirects = 10

  if (opts.url) parseOptsUrl(opts)
  if (!opts.headers) opts.headers = {}

  var body = opts.body
  opts.body = undefined
  if (body && !opts.method) opts.method = 'POST'

  // Request gzip/deflate
  var customAcceptEncoding = Object.keys(opts.headers).some(function (h) {
    return h.toLowerCase() === 'accept-encoding'
  })
  if (!customAcceptEncoding) opts.headers['accept-encoding'] = 'gzip, deflate'

  // Support http: and https: urls
  var protocol = opts.protocol === 'https:' ? https : http
  var req = protocol.request(opts, function (res) {
    // Follow 3xx redirects
    if (res.statusCode >= 300 && res.statusCode < 400 && 'location' in res.headers) {
      opts.url = res.headers.location
      parseOptsUrl(opts)
      res.resume() // Discard response
      opts.maxRedirects -= 1
      return simpleGet(opts, cb)
    }

    cb(null, unzipResponse(res))
  })
  req.on('error', cb)
  req.end(body)
  return req
}

module.exports.concat = function (opts, cb) {
  return simpleGet(opts, function (err, res) {
    if (err) return cb(err)
    var chunks = []
    res.on('data', function (chunk) {
      chunks.push(chunk)
    })
    res.on('end', function () {
      cb(null, Buffer.concat(chunks), res)
    })
  })
}

;['get', 'post', 'put', 'patch', 'head', 'delete'].forEach(function (method) {
  module.exports[method] = function (opts, cb) {
    if (typeof opts === 'string') opts = { url: opts }
    opts.method = method.toUpperCase()
    return simpleGet(opts, cb)
  }
})

function parseOptsUrl (opts) {
  var loc = url.parse(opts.url)
  if (loc.hostname) opts.hostname = loc.hostname
  if (loc.port) opts.port = loc.port
  if (loc.protocol) opts.protocol = loc.protocol
  opts.path = loc.path
  delete opts.url
}
