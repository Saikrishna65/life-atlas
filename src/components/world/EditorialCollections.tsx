"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { DemoNote, SearchField, Modal, Empty } from "./primitives";
import { searchRecords } from "@/data/demo/selectors";
const food = [
  [
    "A morning in Varanasi",
    "Breakfast",
    "A small, freshly made breakfast near the old lanes. Ask a local host where they eat, confirm ingredients, and give the morning time to unfold.",
    "Look for a busy, established vendor, safe drinking water, and freshly prepared food. Preferences and dietary needs should lead the choice.",
  ],
  [
    "Tea, with a view",
    "Tea & coffee",
    "In Munnar, a tea stop is an invitation to pay attention: the warmth of the cup, the weather, and the work behind the leaves.",
    "Arrange an established tea-estate visit where available; confirm access and hours locally.",
  ],
  [
    "The long lunch in Coorg",
    "Lunch",
    "A shared table is a good place to learn about a region. Explore Kodava cooking through an established local host.",
    "Discuss dietary needs and ingredients before a meal. This is a cultural prompt, not a restaurant endorsement.",
  ],
  [
    "A bakery by the coast",
    "Breakfast",
    "Goa’s village bakeries offer a different way to meet the morning. A short walk and a warm loaf can be an entire plan.",
    "Visit during opening hours, ask before photographing people, and keep village streets clear.",
  ],
  [
    "A table in the backwaters",
    "Lunch",
    "A simple lunch beside the water makes a gentle pause in a Kerala day. Let the conversation last longer than the meal.",
    "Choose a reputable operator and confirm food handling and dietary arrangements.",
  ],
  [
    "Kyoto, one cup at a time",
    "Tea & coffee",
    "A quiet tea experience rewards a slower pace. Book with a reputable host and arrive ready to learn.",
    "Check etiquette and photography rules with the host. No particular venue is endorsed.",
  ],
  [
    "Osaka after dark",
    "Dinner",
    "A neighborhood food walk can offer a city in miniature: tiny counters, familiar regulars, and a new dish worth asking about.",
    "Use established venues; check ingredients, allergens, and last train times.",
  ],
  [
    "A market morning in Seoul",
    "Breakfast",
    "Walk the market first. Notice what is being cooked, ask respectfully, and choose one thing to understand properly.",
    "Cash, dietary notes in the local language, and an unhurried approach are useful companions.",
  ],
  [
    "A mountain café in Bir",
    "Tea & coffee",
    "After a walk, a small café is a perfectly reasonable destination. No altitude statistics required.",
    "Check current hours locally and avoid treating cafés as trail safety sources.",
  ],
  [
    "Lisbon, late afternoon",
    "Tea & coffee",
    "An afternoon coffee and something from a neighborhood bakery. Sit long enough to watch the light change.",
    "Ask the staff about local specialties and dietary ingredients.",
  ],
  [
    "A lakeside dinner in Udaipur",
    "Dinner",
    "End the day with an early, unhurried meal and a walk. The view is a bonus; the company is the main event.",
    "Confirm current menus, prices, and accessibility directly with the venue.",
  ],
  [
    "Tokyo at a small counter",
    "Dinner",
    "Choose a neighborhood, then a small place that welcomes visitors. A few thoughtful questions can open an entire evening.",
    "Respect reservation policies, seating limits, and rules about photography.",
  ],
];
const cinema = [
  [
    "Before Sunrise",
    "Connection",
    "1995 · Richard Linklater",
    "A walk, a conversation, and a city discovered in the space between two people.",
    "Notice how the streets become part of the conversation. A useful reminder that a journey can be measured in attention.",
  ],
  [
    "The Secret Life of Walter Mitty",
    "Adventure",
    "2013 · Ben Stiller",
    "An imaginative journey about stepping beyond familiar routines.",
    "A visual prompt for asking which adventures belong on a real calendar, and which are happy to remain daydreams.",
  ],
  [
    "The Darjeeling Limited",
    "Connection",
    "2007 · Wes Anderson",
    "Three brothers travel together while carrying more than their luggage.",
    "Look at how objects and rituals hold family history. The film is fiction, not a cultural guide.",
  ],
  [
    "Piku",
    "Connection",
    "2015 · Shoojit Sircar",
    "A road journey threaded through family, responsibility, and ordinary affection.",
    "The everyday details do much of the emotional work. Think about the moments you would keep in a family journal.",
  ],
  [
    "Karwaan",
    "Adventure",
    "2018 · Akarsh Khurana",
    "An unexpected road trip with a dry sense of humor and an open heart.",
    "An invitation to notice the people beside you when the route changes.",
  ],
  [
    "Zindagi Na Milegi Dobara",
    "Adventure",
    "2011 · Zoya Akhtar",
    "Friendship, a Spanish road trip, and the courage to reconsider a familiar life.",
    "Which small act of courage would actually fit into your next week?",
  ],
  [
    "Perfect Days",
    "Stillness",
    "2023 · Wim Wenders",
    "A quiet Tokyo life seen through routine, music, trees, and attention.",
    "Watch how repetition can reveal differences instead of erasing them.",
  ],
  [
    "Paterson",
    "Stillness",
    "2016 · Jim Jarmusch",
    "Poetry and daily routines in a small American city.",
    "Keep one ordinary detail from today. It does not need to become a poem to be worth noticing.",
  ],
  [
    "The Lunchbox",
    "Connection",
    "2013 · Ritesh Batra",
    "A misplaced lunch becomes the beginning of a correspondence.",
    "Consider how a meal can carry care across a city.",
  ],
  [
    "Wild",
    "Adventure",
    "2014 · Jean-Marc Vallée",
    "A difficult long-distance walk through memory and grief.",
    "Treat the film as storytelling, not a hiking or safety guide. Preparation and local conditions matter.",
  ],
  [
    "Little Forest",
    "Stillness",
    "2018 · Yim Soon-rye",
    "Cooking, seasons, and a return to a quieter place.",
    "Notice the relationship between food, weather, and a sense of home.",
  ],
  [
    "The Station Agent",
    "Connection",
    "2003 · Tom McCarthy",
    "Unexpected friendship grows around a small railway depot.",
    "Some journeys involve staying long enough to let people in.",
  ],
];
export default function EditorialCollections({
  kind,
}: {
  kind: "food" | "cinema";
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All chapters");
  const [selected, setSelected] = useState<string | null>(null);
  const records = (kind === "food" ? food : cinema).map(
    ([title, category, meta, description, note], i) => ({
      id: `${kind}-${i + 1}`,
      title,
      category,
      meta: kind === "food" ? "A local travel prompt" : meta,
      description: kind === "food" ? meta : description,
      note: kind === "food" ? description : note,
    }),
  );
  const filtered = searchRecords(
    records,
    query,
    (r) => `${r.title} ${r.category} ${r.meta} ${r.description}`,
  ).filter((r) => category === "All chapters" || r.category === category);
  const current = records.find((r) => r.id === selected);
  return (
    <div className="editorial-collections">
      <div className="directory-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label={`Search ${kind === "food" ? "food stories" : "film notes"}`}
          placeholder={
            kind === "food"
              ? "A place, a taste, a pause"
              : "Find a film or a feeling"
          }
        />
        <div className="world-filter-pills">
          {["All chapters", ...new Set(records.map((r) => r.category))].map(
            (c) => (
              <button
                aria-pressed={category === c}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ),
          )}
        </div>
      </div>
      <DemoNote>
        {kind === "food"
          ? "Illustrative travel prompts. No venue endorsements or live reservations."
          : "Editorial film notes. No films, trailers, or copyrighted playback are distributed."}
      </DemoNote>
      <div className="editorial-story-list">
        {filtered.map((r, i) => (
          <button key={r.id} onClick={() => setSelected(r.id)}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <small>
                {r.category} / {r.meta}
              </small>
              <h2>{r.title}</h2>
              <p>{r.description}</p>
            </div>
            <ArrowUpRight size={25} />
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          onReset={() => {
            setQuery("");
            setCategory("All chapters");
          }}
        >
          No matches here. Try another chapter.
        </Empty>
      )}
      {current && (
        <Modal title={current.title} onClose={() => setSelected(null)}>
          <div className="editorial-note">
            <span className="world-eyebrow">
              {current.category} / {current.meta}
            </span>
            <h2>{current.title}</h2>
            <p>{current.description}</p>
            <h3>
              {kind === "food"
                ? "A little care before you go"
                : "Something to carry with you"}
            </h3>
            <p>{current.note}</p>
            <DemoNote>
              {kind === "food"
                ? "Sample cultural prompt. Check current details independently."
                : "Editorial commentary. Titles and credits identify the original films."}
            </DemoNote>
          </div>
        </Modal>
      )}
    </div>
  );
}
