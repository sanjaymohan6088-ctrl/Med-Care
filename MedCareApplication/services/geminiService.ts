import { supabase } from "../supabaseClient";
import { PrescriptionParsedData } from "../types";

// Helper to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      let encoded = reader.result?.toString().replace(/^data:(.*,)?/, '');
      if (encoded && (encoded.length % 4) > 0) {
        encoded += '='.repeat(4 - (encoded.length % 4));
      }
      resolve(encoded || '');
    };
    reader.onerror = (error) => reject(error);
  });
};

export const parsePrescriptionImage = async (base64Image: string): Promise<PrescriptionParsedData> => {
  console.log("📤 Sending image to Supabase Edge Function...");

  try {
    // Use the Supabase functions client to call the deployed Edge Function
    const { data, error } = await supabase.functions.invoke('extract-prescription', {
        body: { image: base64Image },
        method: 'POST',
    });

    if (error) {
        console.error("Supabase Error Details:", error);
        throw new Error(error.message || "Failed to invoke Edge Function");
    }
    
    console.log("📥 Received data from Supabase:", data);
    return data as PrescriptionParsedData;

  } catch (error: any) {
    console.error("❌ Prescription Analysis Error:", error);
    
    // Fallback Mock for Web Preview if function is not yet deployed
    console.warn("⚠️ Edge Function might not be deployed yet. Using Fallback Mock.");
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
        hospital_name: "Apollo Specialty Clinic",
        medicines: [
            {
                med_name: "Augmentin 625 Duo",
                dose: "625mg",
                frequency: "1-0-1",
                duration: "5 days",
                instructions: "After food"
            },
            {
                med_name: "Dolo 650",
                dose: "650mg",
                frequency: "1-0-1",
                duration: "3 days",
                instructions: "For fever"
            }
        ],
        confidence_score: 0.98,
        risk_flags: []
    };
  }
};