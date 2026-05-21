// This service is deprecated. 
// We have migrated to Supabase Edge Functions (see geminiService.ts and supabaseClient.ts).
export const extractPrescriptionFn = async (data: any) => {
    throw new Error("Firebase Cloud Functions are disabled. Use Supabase.");
};