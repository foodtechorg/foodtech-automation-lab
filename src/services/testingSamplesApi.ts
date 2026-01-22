import { supabase } from '@/integrations/supabase/client';

export interface TestingSample {
  id: string;
  request_id: string;
  sample_id: string;
  sample_code: string;
  recipe_code: string;
  working_title: string;
  display_name: string;
  status: 'Sent' | 'Approved' | 'Rejected';
  sent_at: string;
  sent_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  manager_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetTestingResultResponse {
  success: boolean;
  result: string;
  request_status: string;
}

export interface DeclineRequestResponse {
  success: boolean;
  request_status: string;
}

// Fetch testing samples for a request
export async function fetchTestingSamplesByRequestId(
  requestId: string
): Promise<TestingSample[]> {
  const { data, error } = await supabase
    .from('rd_request_testing_samples' as never)
    .select('*')
    .eq('request_id', requestId)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as TestingSample[];
}

// Set testing result for a sample (manager action)
export async function setTestingResult(
  testingSampleId: string,
  result: 'Approved' | 'Rejected',
  comment?: string
): Promise<SetTestingResultResponse> {
  const { data, error } = await supabase.rpc(
    'set_sample_testing_result' as never,
    {
      p_testing_sample_id: testingSampleId,
      p_result: result,
      p_comment: comment || null,
    } as never
  );

  if (error) throw error;
  return data as unknown as SetTestingResultResponse;
}

// Decline entire request from testing (manager action)
export async function declineRequestFromTesting(
  requestId: string,
  comment?: string
): Promise<DeclineRequestResponse> {
  const { data, error } = await supabase.rpc(
    'decline_request_from_testing' as never,
    {
      p_request_id: requestId,
      p_comment: comment || null,
    } as never
  );

  if (error) throw error;
  return data as unknown as DeclineRequestResponse;
}

// Status labels for UI
export const testingSampleStatusLabels: Record<TestingSample['status'], string> = {
  Sent: 'Очікує оцінки',
  Approved: 'Погоджено',
  Rejected: 'Відхилено',
};

export const testingSampleStatusColors: Record<TestingSample['status'], string> = {
  Sent: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
