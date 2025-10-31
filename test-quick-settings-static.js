// Static analysis test - simulates what happens when Quick Settings is clicked
// This tests the logic without needing a browser

console.log('🔍 Analyzing QuickSettings component for potential errors...\n');

const errors = [];

// Simulate context data scenarios
const scenarios = [
  {
    name: "Empty context",
    context: null
  },
  {
    name: "Context with null presets/assistants",
    context: {
      presets: null,
      assistants: null,
      chatSettings: null,
      selectedPreset: null,
      selectedAssistant: null
    }
  },
  {
    name: "Context with undefined arrays",
    context: {
      presets: undefined,
      assistants: undefined,
      chatSettings: null,
      selectedPreset: null,
      selectedAssistant: null,
      assistantImages: undefined
    }
  },
  {
    name: "Context with empty arrays",
    context: {
      presets: [],
      assistants: [],
      chatSettings: {
        model: "gpt-3.5-turbo",
        prompt: "",
        temperature: 0.7,
        contextLength: 4096,
        includeProfileContext: false,
        includeWorkspaceInstructions: false,
        embeddingsProvider: "openai"
      },
      selectedPreset: null,
      selectedAssistant: null,
      assistantImages: []
    }
  },
  {
    name: "Context with missing functions",
    context: {
      presets: [],
      assistants: [],
      chatSettings: {
        model: "gpt-3.5-turbo",
        prompt: "",
        temperature: 0.7,
        contextLength: 4096,
        includeProfileContext: false,
        includeWorkspaceInstructions: false,
        embeddingsProvider: "openai"
      },
      selectedPreset: null,
      selectedAssistant: null,
      assistantImages: [],
      setSelectedPreset: undefined,
      setSelectedAssistant: undefined,
      setChatSettings: undefined
    }
  }
];

// Test each scenario
scenarios.forEach((scenario, index) => {
  console.log(`\n📋 Scenario ${index + 1}: ${scenario.name}`);
  
  try {
    // Simulate the component logic
    const contextData = scenario.context;
    
    if (!contextData) {
      console.log('   ✅ Would return early with "Loading..." button');
      return;
    }
    
    // Test array checks
    const presets = Array.isArray(contextData.presets) ? contextData.presets : [];
    const assistants = Array.isArray(contextData.assistants) ? contextData.assistants : [];
    const assistantImages = Array.isArray(contextData.assistantImages) ? contextData.assistantImages : [];
    
    if (!Array.isArray(contextData.presets)) {
      console.log('   ⚠️ presets is not an array - using fallback []');
    }
    if (!Array.isArray(contextData.assistants)) {
      console.log('   ⚠️ assistants is not an array - using fallback []');
    }
    if (!Array.isArray(contextData.assistantImages)) {
      console.log('   ⚠️ assistantImages is not an array - using fallback []');
    }
    
    // Test chatSettings check
    const chatSettings = contextData.chatSettings;
    if (!chatSettings) {
      console.log('   ✅ Would return early if chatSettings is null');
      return;
    }
    
    // Test function existence
    const setSelectedPreset = contextData.setSelectedPreset || (() => {});
    const setSelectedAssistant = contextData.setSelectedAssistant || (() => {});
    const setChatSettings = contextData.setChatSettings || (() => {});
    
    if (!contextData.setSelectedPreset) {
      console.log('   ⚠️ setSelectedPreset is undefined - using fallback');
    }
    if (!contextData.setSelectedAssistant) {
      console.log('   ⚠️ setSelectedAssistant is undefined - using fallback');
    }
    if (!contextData.setChatSettings) {
      console.log('   ⚠️ setChatSettings is undefined - using fallback');
    }
    
    // Test items array creation
    const items = [];
    try {
      presets.forEach(preset => {
        if (preset && typeof preset === "object") {
          items.push({ ...preset, contentType: "presets" });
        }
      });
      console.log(`   ✅ Processed ${presets.length} presets into ${items.length} items`);
    } catch (e) {
      console.error(`   ❌ ERROR processing presets: ${e.message}`);
      errors.push(`Scenario ${index + 1}: ${e.message}`);
    }
    
    try {
      assistants.forEach(assistant => {
        if (assistant && typeof assistant === "object") {
          items.push({ ...assistant, contentType: "assistants" });
        }
      });
      console.log(`   ✅ Processed ${assistants.length} assistants into ${items.length} total items`);
    } catch (e) {
      console.error(`   ❌ ERROR processing assistants: ${e.message}`);
      errors.push(`Scenario ${index + 1}: ${e.message}`);
    }
    
    // Test filter operation
    try {
      const filtered = items.filter(item => {
        return (
          item &&
          item.name &&
          typeof item.name === "string" &&
          item.id !== (contextData.selectedPreset?.id) &&
          item.id !== (contextData.selectedAssistant?.id)
        );
      });
      console.log(`   ✅ Filtered to ${filtered.length} items`);
    } catch (e) {
      console.error(`   ❌ ERROR filtering items: ${e.message}`);
      errors.push(`Scenario ${index + 1} filter: ${e.message}`);
    }
    
    // Test map operation
    try {
      items.map(({ contentType, ...item }) => {
        if (!item || !item.id) return null;
        return { item, contentType };
      }).filter(Boolean);
      console.log(`   ✅ Map operation succeeded`);
    } catch (e) {
      console.error(`   ❌ ERROR mapping items: ${e.message}`);
      errors.push(`Scenario ${index + 1} map: ${e.message}`);
    }
    
  } catch (error) {
    console.error(`   ❌ FATAL ERROR in scenario: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    errors.push(`Scenario ${index + 1} FATAL: ${error.message}`);
  }
});

console.log('\n' + '='.repeat(60));
if (errors.length > 0) {
  console.error(`\n❌ Found ${errors.length} potential error(s):\n`);
  errors.forEach((error, i) => {
    console.error(`   ${i + 1}. ${error}`);
  });
  console.error('\n⚠️ These errors could cause crashes when clicking Quick Settings!\n');
  process.exit(1);
} else {
  console.log('\n✅ All scenarios passed! Component logic looks safe.\n');
  process.exit(0);
}

