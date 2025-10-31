import { Database, Tables } from "@/supabase/types"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function getServerProfile() {
  // No-auth mode: use environment variables for API keys
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!hasSupabase) {
    // Return a profile using environment variables for API keys
    const guestProfile = {
      id: "guest",
      user_id: "guest",
      display_name: "Guest",
      username: "guest",
      has_onboarded: true,
      image_path: "",
      image_url: "",
      bio: "",
      profile_context: "",
      openai_api_key: process.env.OPENAI_API_KEY || null,
      anthropic_api_key: process.env.ANTHROPIC_API_KEY || null,
      google_gemini_api_key: null,
      mistral_api_key: null,
      perplexity_api_key: null,
      openrouter_api_key: null,
      groq_api_key: null,
      use_azure_openai: false,
      azure_openai_api_key: null,
      azure_openai_endpoint: null,
      azure_openai_35_turbo_id: null,
      azure_openai_45_turbo_id: null,
      azure_openai_45_vision_id: null,
      azure_openai_embeddings_id: null,
      openai_organization_id: null,
      use_google_gemini: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Tables<"profiles">

    const profileWithKeys = addApiKeysToProfile(guestProfile)
    return profileWithKeys
  }

  // Auth mode: use Supabase
  try {
    const cookieStore = cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      console.error("Supabase auth error:", userError)
      throw new Error("User not found")
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userData.user.id)
      .single()

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError)
      throw new Error("Profile not found")
    }

    const profileWithKeys = addApiKeysToProfile(profile)

    return profileWithKeys
  } catch (error: any) {
    console.error("getServerProfile error:", {
      message: error.message,
      stack: error.stack
    })
    // Fallback to no-auth mode if Supabase fails
    const guestProfile = {
      id: "guest",
      user_id: "guest",
      display_name: "Guest",
      username: "guest",
      has_onboarded: true,
      image_path: "",
      image_url: "",
      bio: "",
      profile_context: "",
      openai_api_key: process.env.OPENAI_API_KEY || null,
      anthropic_api_key: process.env.ANTHROPIC_API_KEY || null,
      google_gemini_api_key: null,
      mistral_api_key: null,
      perplexity_api_key: null,
      openrouter_api_key: null,
      groq_api_key: null,
      use_azure_openai: false,
      azure_openai_api_key: null,
      azure_openai_endpoint: null,
      azure_openai_35_turbo_id: null,
      azure_openai_45_turbo_id: null,
      azure_openai_45_vision_id: null,
      azure_openai_embeddings_id: null,
      openai_organization_id: null,
      use_google_gemini: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as Tables<"profiles">

    const profileWithKeys = addApiKeysToProfile(guestProfile)
    return profileWithKeys
  }
}

function addApiKeysToProfile(profile: Tables<"profiles">) {
  const apiKeys = {
    [VALID_ENV_KEYS.OPENAI_API_KEY]: "openai_api_key",
    [VALID_ENV_KEYS.ANTHROPIC_API_KEY]: "anthropic_api_key",
    [VALID_ENV_KEYS.GOOGLE_GEMINI_API_KEY]: "google_gemini_api_key",
    [VALID_ENV_KEYS.MISTRAL_API_KEY]: "mistral_api_key",
    [VALID_ENV_KEYS.GROQ_API_KEY]: "groq_api_key",
    [VALID_ENV_KEYS.PERPLEXITY_API_KEY]: "perplexity_api_key",
    [VALID_ENV_KEYS.AZURE_OPENAI_API_KEY]: "azure_openai_api_key",
    [VALID_ENV_KEYS.OPENROUTER_API_KEY]: "openrouter_api_key",

    [VALID_ENV_KEYS.OPENAI_ORGANIZATION_ID]: "openai_organization_id",

    [VALID_ENV_KEYS.AZURE_OPENAI_ENDPOINT]: "azure_openai_endpoint",
    [VALID_ENV_KEYS.AZURE_GPT_35_TURBO_NAME]: "azure_openai_35_turbo_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_VISION_NAME]: "azure_openai_45_vision_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_TURBO_NAME]: "azure_openai_45_turbo_id",
    [VALID_ENV_KEYS.AZURE_EMBEDDINGS_NAME]: "azure_openai_embeddings_id"
  }

  for (const [envKey, profileKey] of Object.entries(apiKeys)) {
    if (process.env[envKey]) {
      ;(profile as any)[profileKey] = process.env[envKey]
    }
  }

  return profile
}

export function checkApiKey(apiKey: string | null, keyName: string) {
  if (apiKey === null || apiKey === "") {
    throw new Error(`${keyName} API Key not found`)
  }
}
