import { createClient } from '@supabase/supabase-js';

// Credentials provided for the switch to Supabase Edge Functions
const supabaseUrl = 'https://jbivwvngxyzuemkqzcwu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiaXZ3dm5neHl6dWVta3F6Y3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MDM1OTYsImV4cCI6MjA3OTI3OTU5Nn0.MVUuWoV1L-Ycsi0Hf0GC-AX7OtCJ8tm3YzLTrabtvCo'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);