import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LabClient from './lab-client'

export default async function LabPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reports } = await supabase
    .from('lab_reports')
    .select('id, filename, report_type, report_date, summary, structured_data, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return <LabClient initialReports={reports ?? []} />
}
