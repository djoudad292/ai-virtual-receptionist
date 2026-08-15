'use client'

import { useEffect } from 'react'

interface WidgetEmbedProps {
  companyId: string
  title?: string
}

export default function WidgetEmbed({ companyId, title = 'AI Assistant' }: WidgetEmbedProps) {
  useEffect(() => {
    if (!companyId) return
    if (document.querySelector('script[data-widget-embed]')) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ai-receptionist-backend-h14q.onrender.com'
    const s = document.createElement('script')
    s.src = `${process.env.NEXT_PUBLIC_WIDGET_URL || apiUrl}/widget.js`
    s.async = true
    s.setAttribute('data-widget-embed', '1')
    s.setAttribute('data-api-url', apiUrl)
    s.setAttribute('data-ws-url', process.env.NEXT_PUBLIC_WS_URL || apiUrl)
    s.setAttribute('data-company-id', companyId)
    s.setAttribute('data-title', title)
    document.body.appendChild(s)
  }, [companyId, title])

  return null
}
