/**
 * The only place that touches Express. Express imposes multi-argument middleware signatures,
 * so this file is whitelisted from the single-parameter lint rule.
 */
import {
  continueTrace,
  formatTraceparent,
  serializeError,
  TRACEPARENT_HEADER,
  type TraceContext,
} from '@inspiratio/shared'
import express, {
  type ErrorRequestHandler,
  type Express,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express'
import multer from 'multer'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Logger } from '../logging/logger.ts'
import { runWithTrace } from '../logging/trace-context.ts'
import type { HttpRequest, Route, UploadedFile } from './http.types.ts'
import { errorResponse } from './responses.ts'

export type ExpressAppOptions = {
  readonly routes: readonly Route[]
  readonly logger: Logger
  readonly mediaDir: string
  readonly webDistDir: string | null
  readonly maxUploadBytes: number
}

type TracedLocals = { trace: TraceContext }

const traceOf = (res: Response): TraceContext => (res.locals as TracedLocals).trace

const toUploadedFiles = (req: Request): UploadedFile[] => {
  const files = Array.isArray(req.files) ? req.files : []
  return files.map((file) => ({
    originalName: file.originalname,
    mimeType: file.mimetype,
    bytes: new Uint8Array(file.buffer),
  }))
}

const stringParams = (req: Request): Record<string, string> => {
  const entries = Object.entries(req.params as Record<string, unknown>)
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]))
}

const traceMiddleware = (logger: Logger): RequestHandler => {
  return (req, res, next) => {
    const trace = continueTrace(req.header(TRACEPARENT_HEADER))
    ;(res.locals as TracedLocals).trace = trace
    res.setHeader(TRACEPARENT_HEADER, formatTraceparent(trace))
    res.setHeader('access-control-expose-headers', TRACEPARENT_HEADER)
    const startedAt = performance.now()
    runWithTrace({
      trace,
      run: () => {
        res.on('finish', () => {
          runWithTrace({
            trace,
            run: () => {
              logger.info({
                msg: 'http.request',
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                durationMs: Math.round(performance.now() - startedAt),
              })
            },
          })
        })
        next()
      },
    })
  }
}

const toExpressHandler = (params: {
  readonly route: Route
  readonly logger: Logger
}): RequestHandler => {
  return (req, res, next) => {
    const trace = traceOf(res)
    const request: HttpRequest = {
      params: stringParams(req),
      query: req.query,
      body: req.body,
      files: toUploadedFiles(req),
      trace,
      logger: params.logger,
    }
    runWithTrace({
      trace,
      run: () => {
        params.route
          .handler(request)
          .then((response) => {
            if (response.body === undefined) res.status(response.status).end()
            else res.status(response.status).json(response.body)
          })
          .catch(next)
      },
    })
  }
}

const errorHandler = (logger: Logger): ErrorRequestHandler => {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const trace = traceOf(res)
    const isTooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
    const isBadJson = error instanceof SyntaxError
    runWithTrace({
      trace,
      run: () => {
        logger.error({ msg: 'http.unhandled_error', error: serializeError(error) })
      },
    })
    const response = errorResponse({
      error: isTooLarge
        ? { code: 'validation', message: 'File too large' }
        : isBadJson
          ? { code: 'validation', message: 'Malformed JSON body' }
          : { code: 'upstream', message: 'Unexpected server error' },
      traceId: trace.traceId,
    })
    res.status(isTooLarge || isBadJson ? 400 : 500).json(response.body)
  }
}

export const createExpressApp = (options: ExpressAppOptions): Express => {
  const app = express()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxUploadBytes, files: 50 },
  })

  app.disable('x-powered-by')
  app.use(traceMiddleware(options.logger))
  app.use(express.json({ limit: '2mb' }))
  app.use('/media', express.static(options.mediaDir, { maxAge: '7d', immutable: true }))

  for (const route of options.routes) {
    const handler = toExpressHandler({ route, logger: options.logger })
    if (route.upload === true) app[route.method](route.path, upload.array('files'), handler)
    else app[route.method](route.path, handler)
  }

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json(
      errorResponse({
        error: { code: 'not_found', message: 'Unknown API route' },
        traceId: traceOf(res).traceId,
      }).body,
    )
  })

  const webDistDir = options.webDistDir
  if (webDistDir !== null && existsSync(webDistDir)) {
    app.use(express.static(webDistDir))
    app.get(/^(?!\/(api|media)\/).*/, (_req: Request, res: Response) => {
      res.sendFile(join(webDistDir, 'index.html'))
    })
  }

  app.use(errorHandler(options.logger))
  return app
}
