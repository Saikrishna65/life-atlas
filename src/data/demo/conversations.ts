import type { Conversation, DemoTopic, Workflow } from "./types";
const samples: Record<DemoTopic, [string, string][]> = {
  Travel: [
    [
      "Plan five unhurried days around Chopta.",
      "Start with a gentle arrival day, then keep Tungnath for the best weather window. Give Chandrashila its own decision point: conditions, energy, and a local guide all get a vote. Mountains are terrible at respecting spreadsheets.",
    ],
    [
      "Can I squeeze Spiti into a weekend?",
      "You can squeeze many things into a weekend. Sensible acclimatization is not one of them. I’d use a short break for Bir or a nearby valley, and save Spiti for a slower trip.",
    ],
    [
      "I want to see Kyoto without racing around.",
      "Pick one district per day. A garden in the morning, a long lunch, then a riverside walk. Three well-enjoyed places beat twelve blurry ones.",
    ],
    [
      "What should I pack for a mountain sunrise?",
      "Warm layers, water, a charged light, sun protection, and shoes you already trust. Check the forecast and route with a local guide. New boots do not need a dramatic debut.",
    ],
    [
      "Find a quieter alternative to a beach party.",
      "Try a village stay with a walkable coast. Leave the first morning empty, ask about safe swimming locally, and let the nearest bakery become a landmark.",
    ],
    [
      "How do I leave room for bad weather in Iceland?",
      "Keep an unscheduled day, book flexible stays where possible, and avoid an itinerary that requires a long drive every morning. A forecast is advice from someone who actually lives in the sky.",
    ],
    [
      "Make a rail-first Alps itinerary.",
      "Base yourself in one valley, use rail for the main transfers, then choose marked day walks around the forecast. Verify train times and trail conditions before you book.",
    ],
  ],
  Music: [
    [
      "Something for a long road with no hurry.",
      "Try the sample collection “Somewhere, slowly”: warm ambient textures and a little folk. This catalog is fictional and visual-only, so your speakers get the afternoon off.",
    ],
    [
      "A playlist for reading while it rains?",
      "“Monsoon on repeat” is the mood: soft instrumentals and very little demanding your attention. Rain already has the percussion covered.",
    ],
    [
      "Why does every work playlist distract me?",
      "Try fewer vocals, steadier dynamics, and a smaller familiar set. Your brain cannot edit a document and audition a new lead singer with equal enthusiasm.",
    ],
    [
      "What is downtempo?",
      "Electronic music with a relaxed pace and room for texture. Think atmosphere and groove with less urgency. It is a broad family, not a speed limit.",
    ],
    [
      "Find a soundtrack for a city after midnight.",
      "The fictional “After the last train” collection fits: spacious electronics, low light, and a slightly inconvenient amount of introspection.",
    ],
    [
      "Can you play a song here?",
      "This public demo has no licensed audio, so I can show a visual concept and track notes only. There is no hidden playback happening.",
    ],
    [
      "Help me sort my listening moods.",
      "Start with four honest labels: focus, wandering, reflective, after dark. Genre can be a filter; mood tells you what you actually need.",
    ],
  ],
  Reminders: [
    [
      "Remind me to check my train tickets.",
      "In this example, I’d draft “Check train tickets” for tomorrow at 9:00. Nothing has been scheduled outside this demo.",
    ],
    [
      "I keep forgetting the small packing things.",
      "Use a short departure checklist: chargers, medication, documents, water. Put it beside the door, because memory becomes remarkably poetic when you need something practical.",
    ],
    [
      "A reminder every Sunday to review the week?",
      "A useful draft: Sunday, 18:00, “Review the week and choose three priorities.” This demonstration only shows the wording.",
    ],
    [
      "When should I check weather for a hike?",
      "Check during planning, the day before, and again before departure. Ask locally about trail conditions. The app icon showing a sun is not a safety assessment.",
    ],
    [
      "Help me make a document checklist.",
      "Keep ID, tickets, booking details, permits if required, insurance details, and offline copies. Check entry requirements with the official source.",
    ],
    [
      "Can I mark a sample reminder done?",
      "Yes, the planning demo can mark its local sample items complete for this visit. It never changes your private reminders.",
    ],
    [
      "I have too many reminders.",
      "Separate dates that matter from ideas that can wait. Give the second group a weekly review instead of twenty notifications. Your phone deserves fewer dramatic entrances.",
    ],
  ],
  Finance: [
    [
      "Why is my example travel budget higher than expected?",
      "The sample estimate includes lodging, transport, food, and activities. Transport is often the quiet plot twist. Open the breakdown to see each amount; these are fictional estimates, not current quotes.",
    ],
    [
      "Explain the sample balance.",
      "Opening balance plus income minus expenses gives the closing balance. All amounts are stored as integer paise, so the demo avoids floating-point rounding surprises.",
    ],
    [
      "Should I spend all my trip budget upfront?",
      "Keep room for meals, local transfers, changes, and an emergency buffer. A fully allocated spreadsheet can still be a very surprised spreadsheet.",
    ],
    [
      "How can I compare two sample trips?",
      "Use the total and cost per day together. A longer trip may cost more overall but less per day. The figures here illustrate the comparison; verify real prices independently.",
    ],
    [
      "What counts as a recurring expense?",
      "A regular commitment such as rent or a subscription. Predictable does not mean permanent; a monthly review is usually worthwhile.",
    ],
    [
      "Why store money in paise?",
      "Integer minor units make addition and subtraction exact for these records. Convert to rupees for display at the edge of the interface.",
    ],
    [
      "Can this public page read my bank account?",
      "No. The figures in this public experience are isolated sample transactions. No private finance store is imported here.",
    ],
  ],
  Conversation: [
    [
      "I want to go somewhere, but I am tired.",
      "Then maybe the adventure is a short train ride, a good lunch, and coming home before you start negotiating with your own knees. Rest can be the itinerary.",
    ],
    [
      "Do you always have a plan?",
      "Usually a draft. A plan that cannot survive a closed café is just a very confident wish.",
    ],
    [
      "Tell me something small to notice today.",
      "The moment a room changes when the afternoon light reaches the wall. No productivity metric required.",
    ],
    [
      "I took no photos on my favorite day.",
      "That still counts as a favorite day. The camera roll is not the admissions office for your life.",
    ],
    [
      "What if I do nothing this weekend?",
      "Make it deliberate, and it becomes a choice instead of a guilt spiral. A walk and a decent breakfast are optional supporting characters.",
    ],
    [
      "I keep planning the same trip.",
      "Choose one real next step: dates, a savings target, or asking a friend. Inspiration is lovely, but it rarely books the train.",
    ],
    [
      "Give this journal a title.",
      "“The Long Way, Gladly.” A little stubborn, a little hopeful. Seems appropriate for a trip that included three wrong turns and a very good bakery.",
    ],
  ],
  Planning: [
    [
      "Help me plan a day that has some breathing room.",
      "Choose one essential task, one useful task, and one thing that makes the day better. Leave a buffer. Your calendar does not need to resemble airport departures.",
    ],
    [
      "Everything on my list feels urgent.",
      "Write down the actual deadline and consequence for each item. Urgency gets less theatrical when it has to produce evidence.",
    ],
    [
      "I have 30 minutes before a meeting.",
      "Pick one small task you can finish in twenty. Leave ten to prepare and reset. Starting a sprawling new project would be an interesting decision.",
    ],
    [
      "Plan a gentle Sunday review.",
      "Look back at what happened, move unfinished tasks consciously, check the next week, and choose three priorities. Stop before the review needs its own review.",
    ],
    [
      "How much buffer should I leave for travel?",
      "Enough for local conditions and missed connections, especially when tickets are separate. Use official connection guidance and avoid scheduling the important thing immediately after arrival.",
    ],
    [
      "I want a less crowded morning routine.",
      "Keep the sequence short: water, a little movement, breakfast, one clear priority. Add things only when the simpler version already works.",
    ],
    [
      "Can you move my real calendar events?",
      "No. This public demonstration can illustrate a plan, but it has no access to your calendar or private app.",
    ],
  ],
  Organization: [
    [
      "My trip notes are scattered everywhere.",
      "Gather them under one journey: bookings, route, budget, packing, and memories. Use links rather than duplicating the same document five times.",
    ],
    [
      "How should I tag my photos?",
      "Start with place, approximate date, and a meaningful subject. Three useful tags beat fourteen versions of “vibes.”",
    ],
    [
      "Help me name a memory collection.",
      "Use something you will recognize later: “Kerala, slow mornings” tells you more than “Final collection 7.” Future you is a person, not an archaeologist.",
    ],
    [
      "What belongs in a trip overview?",
      "Dates, base locations, transport connections, key documents, and a rough budget. Keep the detailed daily plan one level deeper.",
    ],
    [
      "I save too many things to read.",
      "Choose a small active queue and archive the rest. Saving something is not a legally binding promise to read it.",
    ],
    [
      "How do I connect a song to a memory?",
      "In the sample system, a shared journey context connects moments and sound collections. Your private data stays outside this public demonstration.",
    ],
    [
      "Can I export these example ideas?",
      "You can copy a displayed conversation or download the sample expedition plan. Those actions use only the demonstration content you can see.",
    ],
  ],
  Technology: [
    [
      "What happens if WebGL is unavailable?",
      "The map falls back to an accessible destination list. The orb has a CSS fallback. Reading and browsing still work, because the graphics are guests here.",
    ],
    [
      "Why lazy-load a 3D scene?",
      "It delays the download and GPU work until the scene is close to view. A visitor reading the arrival should not have to pay for every room in the building at once.",
    ],
    [
      "What does reduced motion change?",
      "New scene parallax and ambient movement are removed, while the content and controls remain available. The preserved hero keeps its existing reduced-motion behavior.",
    ],
    [
      "Is the orb a live AI?",
      "No. The orb responds visually to interaction, and these conversations are authored examples stored locally. It does not execute requests or send messages to a model.",
    ],
    [
      "Why use local fixtures?",
      "They make the public demonstration deterministic, reviewable, and independent of private stores, credentials, or network APIs.",
    ],
    [
      "Does visual preview mean audio playback?",
      "No. Here it animates a visual treatment only. There is no audio element and no sound is generated.",
    ],
    [
      "How are demo records connected?",
      "Stable IDs link destinations to expeditions, timelines, photos, and memories. Integrity tests check those references and calculated totals.",
    ],
  ],
};
export const conversations: Conversation[] = Object.entries(samples).flatMap(
  ([topic, pairs], i) =>
    pairs.map(([question, answer], j) => ({
      id: `conversation-${i * 7 + j + 1}`,
      topic: topic as DemoTopic,
      title: question,
      messages: [
        { role: "user", text: question },
        { role: "atlas", text: answer },
      ],
    })),
);
export const workflows: Workflow[] = conversations
  .filter((_, i) => i % 2 === 0)
  .map((c, i) => ({
    id: `workflow-${i + 1}`,
    topic: c.topic,
    title: c.title,
    conversationId: c.id,
    steps: [
      `Understand the ${c.topic.toLowerCase()} request`,
      "Review the relevant sample context",
      "Present an editable suggestion",
    ],
    result: c.messages[1].text,
  }));
