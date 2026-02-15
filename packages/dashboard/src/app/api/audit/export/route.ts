import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditLogsForExport } from '@/lib/data'

/**
 * GET /api/audit/export — export audit logs as CSV or JSON.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'json'

  try {
    const data = await getAuditLogsForExport({
      dateFrom: searchParams.get('dateFrom')
        ? new Date(searchParams.get('dateFrom')!)
        : undefined,
      dateTo: searchParams.get('dateTo')
        ? new Date(searchParams.get('dateTo')!)
        : undefined,
      decision: searchParams.get('decision') ?? undefined,
    })

    if (format === 'csv') {
      const headers = [
        'ID', 'Sequence', 'Agent', 'Method', 'URL', 'Risk Score',
        'Engine Decision', 'Human Decision', 'Rule', 'Latency (ms)',
        'Prev Hash', 'Entry Hash', 'Created At',
      ]
      const csvRows = [headers.join(',')]

      for (const row of data) {
        csvRows.push([
          row.id,
          row.sequenceNumber,
          (row.agentName ?? row.agentId).replace(/,/g, ';'),
          row.requestMethod,
          `"${row.requestUrl.replace(/"/g, '""')}"`,
          row.riskScore,
          row.engineDecision,
          row.humanDecision ?? '',
          (row.ruleName ?? '').replace(/,/g, ';'),
          row.latencyMs,
          row.prevHash,
          row.entryHash,
          new Date(row.createdAt).toISOString(),
        ].join(','))
      }

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // JSON export
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
