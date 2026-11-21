export type Span = {
  spanId: string;
  parentSpanId: string | null;
  operation: string;
  service: string;
  startOffsetMs: number;
  durationMs: number;
  status: 'OK' | 'ERROR';
  attributes: Record<string, string | number | boolean>;
};

export type Trace = {
  traceId: string;
  serviceName: string;
  rootOperation: string;
  totalDurationMs: number;
  status: 'OK' | 'ERROR';
  timestamp: string;
  spans: Span[];
  slowestSpan?: string;
};

export type Analysis = {
  traceId: string;
  totalDurationMs: number;
  criticalPath: string[];
  spans: (Span & {
    selfTimeMs: number;
    inclusiveTimeMs: number;
    percentOfTrace: number;
    critical: boolean;
    slow: boolean;
    hints: string[];
  })[];
  summary: string;
};

const s = (
  id: string,
  parentId: string | null,
  operation: string,
  service: string,
  start: number,
  duration: number,
  status: 'OK' | 'ERROR' = 'OK',
  attributes: Span['attributes'] = {},
): Span => ({
  spanId: id,
  parentSpanId: parentId,
  operation,
  service,
  startOffsetMs: start,
  durationMs: duration,
  status,
  attributes,
});

export const demo: Trace[] = [
  {
    traceId: 'a91f0c2d7e4b8a61',
    serviceName: 'checkout-api',
    rootOperation: 'POST /api/checkout',
    totalDurationMs: 842,
    status: 'OK',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    spans: [
      s('a001', null, 'POST /api/checkout', 'checkout-api', 0, 842, 'OK', { 'http.status_code': 200 }),
      s('a002', 'a001', 'validate-cart', 'checkout-api', 8, 42),
      s('a003', 'a001', 'reserve-inventory', 'inventory-svc', 58, 188, 'OK', { 'db.system': 'postgresql' }),
      s('a004', 'a001', 'initiate-stk-push', 'payments-svc', 258, 521, 'OK', { 'payment.provider': 'mpesa' }),
      s('a005', 'a004', 'POST /stk/request', 'safaricom-adapter', 276, 468, 'OK', { 'retry.count': 1 }),
      s('a006', 'a001', 'publish-order-event', 'event-bus', 798, 31),
    ],
    slowestSpan: 'a005',
  },
  {
    traceId: 'b82e1a9c4f6d0b37',
    serviceName: 'rag-orchestrator',
    rootOperation: 'POST /v1/answer',
    totalDurationMs: 1286,
    status: 'ERROR',
    timestamp: new Date(Date.now() - 480000).toISOString(),
    spans: [
      s('b001', null, 'POST /v1/answer', 'rag-orchestrator', 0, 1286, 'ERROR'),
      s('b002', 'b001', 'embed-query', 'embedding-svc', 12, 94),
      s('b003', 'b001', 'similarity-search', 'vector-db', 120, 742, 'OK', { 'db.system': 'pinecone' }),
      s('b004', 'b001', 'rerank-documents', 'reranker', 878, 210),
      s('b005', 'b001', 'synthesize-answer', 'llm-gateway', 1098, 174, 'ERROR', { 'llm.finish_reason': 'timeout' }),
    ],
    slowestSpan: 'b003',
  },
  {
    traceId: 'c30d7f8a2e5b9146',
    serviceName: 'webhook-worker',
    rootOperation: 'POST /webhooks/payment',
    totalDurationMs: 364,
    status: 'OK',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    spans: [
      s('c001', null, 'POST /webhooks/payment', 'webhook-worker', 0, 364),
      s('c002', 'c001', 'verify-signature', 'webhook-worker', 4, 18),
      s('c003', 'c001', 'persist-event', 'orders-db', 28, 96),
      s('c004', 'c001', 'fanout-notifications', 'notification-svc', 136, 212),
      s('c005', 'c004', 'send-email', 'email-worker', 142, 176),
      s('c006', 'c004', 'send-sms', 'sms-worker', 146, 188),
    ],
    slowestSpan: 'c006',
  },
];

export async function getTraces(): Promise<Trace[]> {
  try {
    const response = await fetch('/api/traces');
    if (!response.ok) throw new Error('Unable to load traces');
    const payload = (await response.json()) as { traces?: Trace[] };
    return Array.isArray(payload.traces) ? payload.traces : demo;
  } catch {
    return demo;
  }
}

export async function analyze(trace: Trace, threshold: number): Promise<Analysis> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        traceId: trace.traceId,
        spans: trace.spans,
        slowThresholdMs: threshold,
      }),
    });
    if (!response.ok) throw new Error('Unable to analyze trace');
    return (await response.json()) as Analysis;
  } catch {
    const spans: Analysis['spans'] = trace.spans.map((span) => {
      const children = trace.spans.filter((child) => child.parentSpanId === span.spanId);
      const slow = span.durationMs >= threshold || span.status === 'ERROR';
      return {
        ...span,
        selfTimeMs: Math.max(
          0,
          span.durationMs - children.reduce((total, child) => total + child.durationMs, 0),
        ),
        inclusiveTimeMs: span.durationMs,
        percentOfTrace: trace.totalDurationMs > 0
          ? (span.durationMs / trace.totalDurationMs) * 100
          : 0,
        critical: slow,
        slow,
        hints: slow
          ? [span.status === 'ERROR'
              ? 'Inspect downstream errors and timeout settings'
              : 'Profile this operation and its dependencies']
          : [],
      };
    });

    return {
      traceId: trace.traceId,
      totalDurationMs: trace.totalDurationMs,
      criticalPath: spans.filter((span) => span.critical).map((span) => span.spanId),
      spans,
      summary: 'Local analysis complete. Inspect the longest spans and any failed operations.',
    };
  }
}
