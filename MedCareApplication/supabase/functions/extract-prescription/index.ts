import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image } = await req.json()
    if (!image) throw new Error("Image data missing")

    // Initialize Gemini with the API Key from Supabase Secrets
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error("GEMINI_API_KEY not set")
    
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Analyze this prescription image. 
      Extract the hospital name.
      Extract a list of medicines including their name, dose, frequency (e.g., 1-0-1, OD, BD), duration, and any instructions.
      
      Return ONLY valid JSON matching this schema:
      {
        "hospital_name": string,
        "medicines": [{ "med_name": string, "dose": string, "frequency": string, "duration": string, "instructions": string }],
        "confidence_score": number,
        "risk_flags": [string]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: image } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsedData = JSON.parse(text);

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})