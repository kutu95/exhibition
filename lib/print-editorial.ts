/**
 * Editorial copy for individual prints.
 *
 * DRAFT STATUS — the per-photograph narrative below extends John's own one-line
 * catalogue descriptions and the historical material already published on /story
 * and /book. It deliberately does not invent circumstances (dates, weather,
 * equipment) that only the photographer can confirm. Anything marked VERIFY
 * should be checked or corrected before it is treated as settled fact.
 *
 * VERIFY: "Black Rock" → "Isaac Rock" renaming. The site states the rock was
 * known as Black Rock at the time of the wreck and is called Isaac Rock today.
 * The copy below says only that; it does not assert who renamed it or when.
 *
 * VERIFY: Contos is described as a neighbouring stretch of the same Cape to Cape
 * coastline, without asserting a compass direction relative to Redgate.
 */

export type PrintEditorial = {
  /** Lead sentence shown under the title. Extends the catalogue description. */
  standfirst: string;
  /** Unique prose about this photograph. */
  body: string[];
  /** Which location essay to append. */
  place: PlaceKey;
  /** Short factual caption used for the image and structured data. */
  caption: string;
};

export type PlaceKey = "redgate" | "isaac-rock" | "contos";

export type PlaceContext = {
  name: string;
  heading: string;
  body: string[];
};

export const PLACE_CONTEXT: Record<PlaceKey, PlaceContext> = {
  redgate: {
    name: "Redgate Beach, Western Australia",
    heading: "About Redgate Beach and Calgardup Bay",
    body: [
      "Redgate Beach sits on the Calgardup Bay shoreline south of Margaret River, on the section of coast now followed by the Cape to Cape Track. It is an ordinary-looking surf beach with an extraordinary thing underneath it: the wreck of the SS Georgette, which grounded here on the morning of 1 December 1876 after her pumps failed and rising water put out her boiler fires.",
      "The wreck lies a few metres down, just offshore. On a rare day — low swell, clear water, low tide, the sand moved off her — the hull shows as a dark line from the beach or from the air. Most days it is invisible, and most people walking the sand have no idea it is there.",
    ],
  },
  "isaac-rock": {
    name: "Isaac Rock, Calgardup Bay",
    heading: "About Isaac Rock",
    body: [
      "Isaac Rock stands off the Calgardup Bay shoreline within sight of where the SS Georgette came ashore. At the time of the wreck in 1876 it was known as Black Rock; today it carries the name Isaac.",
      "That name is the reason this rock recurs through the exhibition. Sam Isaacs, the Aboriginal stockman who rode to the beach with Grace Bussell on the morning of the wreck, was awarded a bronze medal for his part in the rescue while Bussell received silver, a gold watch and a town named after her. The rock is one of the few things on this coast that carries his name at all. Photographing it repeatedly, in every condition the coast offers, is the exhibition's way of keeping him in the frame.",
    ],
  },
  contos: {
    name: "Contos, Western Australia",
    heading: "About the Contos coastline",
    body: [
      "Contos is a neighbouring stretch of the same granite-and-limestone coastline that runs through Calgardup Bay, within the Cape to Cape country south of Margaret River. It is harder, rockier ground than Redgate — reefs and granite mounds standing in moving water.",
      "The Contos photographs sit alongside the Georgette work as part of the same survey of this coast: the same swell, the same light, the same weather systems that put the Georgette on the beach in 1876.",
    ],
  },
};

export const PRINT_EDITORIAL: Record<string, PrintEditorial> = {
  "redgate-beach-panorama-1-1": {
    standfirst:
      "The wreck of the SS Georgette lies just offshore in this frame, hiding in plain sight. She has rested there for 150 years.",
    place: "redgate",
    caption:
      "Panoramic photograph of Redgate Beach, Calgardup Bay, above the wreck site of the SS Georgette",
    body: [
      "This is the photograph the whole exhibition turns on. It is a wide view of an unremarkable beach — sand, swell, headland, sky — and somewhere in the water in front of the camera is an iron steamship that has been on the bottom since 1 December 1876.",
      "Nothing in the frame announces her. That is the point. The Georgette is not a monument or a marked site; she is a shape under moving water that most beach-goers pass without knowing. A hundred and fifty years of sand has covered and uncovered her, divers have taken her propellers and lost one of them again, and the sea has kept the rest.",
      "Printed at panoramic width, the image asks the viewer to do what the photographer did for seven years before a drone finally showed him the hull: look at the water and take it on trust that the history is in there.",
    ],
  },
  "celestial-rock": {
    standfirst:
      "Isaac Rock was known as Black Rock when the Georgette ran aground nearby 150 years ago. On the darkest winter night, the Milky Way points right to it.",
    place: "isaac-rock",
    caption:
      "Night photograph of Isaac Rock, Calgardup Bay, beneath the Milky Way",
    body: [
      "Made on one of the darkest nights of the winter, when there is no moon and no town glow to speak of on this part of the coast, the frame lines the galactic core up over the rock that the 1876 records call Black Rock.",
      "The alignment is a coincidence of geography and season, not a symbol the photographer arranged. But standing on that beach in the dark, with the surf audible and the wreck somewhere out in front of you, the coincidence is difficult to ignore — a piece of sky that has not changed since the night before the Georgette came ashore, pointing at the one landmark on this coast that carries Sam Isaacs' name.",
      "The long exposure required for the stars also smooths the sea, so the water reads as fog rather than swell. The rock is the only hard edge in the picture.",
    ],
  },
  "isaac-rock-red": {
    standfirst:
      "Smokey autumn days during burn-off season make for incredibly red sunsets in the South West. Isaac Rock stands silhouetted against one of them in April.",
    place: "isaac-rock",
    caption:
      "Isaac Rock silhouetted against a red autumn sunset, Calgardup Bay, April",
    body: [
      "Autumn in the South West is burn-off season, and the smoke that drifts off the prescribed burns does something to the light that no filter reproduces honestly: it strips the blue out of the sky and leaves the sun sitting in a band of red that reaches all the way down to the horizon.",
      "Against that, Isaac Rock goes completely black. There is no detail left in it — just the profile, hard against colour. It is the most reduced version of this rock in the collection, and arguably the most accurate to how it would have looked from the deck of a ship standing in too close to this coast.",
      "This is the print offered in the largest range of sizes in the collection, up to A2 on Hahnemühle Photo Rag, because the gradient in the sky needs room to resolve.",
    ],
  },
  "isaac-rock-dolphins": {
    standfirst: "A group of dolphins passes Isaac Rock as they head north.",
    place: "isaac-rock",
    caption: "Dolphins passing Isaac Rock, Calgardup Bay, Western Australia",
    body: [
      "Dolphins work this bay constantly, following bait north and south along the shoreline, and they pass Isaac Rock the way traffic passes a roundabout. Catching them level with the rock, in the same frame, in reasonable light, is largely a matter of being on the beach often enough.",
      "The frame is composed wide and shallow, which puts the animals and the rock on the same line and keeps the horizon doing the work. It is the least dramatic Isaac Rock picture in the collection and, for that reason, the one that most resembles an ordinary morning at Calgardup Bay.",
    ],
  },
  "redgate-lightning": {
    standfirst: "A lightning storm over the horizon off Redgate Beach, after sunset.",
    place: "redgate",
    caption: "Lightning storm off Redgate Beach after sunset, Western Australia",
    body: [
      "Storms tracking up the coast can be watched from Redgate for an hour before they arrive, and after sunset they light themselves from the inside. This frame catches a strike out over the horizon, well offshore, with the last of the daylight still in the water.",
      "Weather of this order is not incidental to the exhibition. The Georgette was lost to water she could not keep out — a leak that beat the pumps and then drowned the fires — and she was put on this beach because her captain had no other option left. The sea in this photograph is the same sea, on a night when it happens to be putting on a show rather than taking a ship.",
      "This is one of two prints in the collection available at A1, at which size the strike reads at close to life scale across a wall.",
    ],
  },
  "redgate-thunderstruck": {
    standfirst: "A singer summons a lightning bolt.",
    place: "redgate",
    caption: "A figure silhouetted on the shore at Redgate Beach as lightning strikes offshore",
    body: [
      "A figure on the shore, arm up, at the moment a bolt lands out to sea. It is a joke and a piece of theatre — the title is not subtle — and it is included in the collection because a body of work about a shipwreck should not be uniformly solemn.",
      "The timing is real. Lightning cannot be cued, so frames like this come from standing in the weather with the shutter running and accepting that most of what you get is empty sky.",
    ],
  },
  "redgate-guitar": {
    standfirst:
      "A guitar player sings from a rock after a beautiful autumn sunset at Redgate Beach.",
    place: "redgate",
    caption: "A guitar player on a rock at Redgate Beach after an autumn sunset",
    body: [
      "Taken after the light had gone, when most people have packed up and left the beach. A guitar player has stayed behind on one of the rocks and is playing to the water.",
      "It is a picture about how this beach is used now. The same sand that took fifty survivors out of the surf in 1876 is, on an ordinary autumn evening a century and a half later, somewhere to sit with a guitar until it gets too dark to see the strings. Both things are true of the place at once, and the exhibition is largely about holding them together.",
    ],
  },
  "2019-04-26-redgate-surfer-splash": {
    standfirst:
      "The little rock makes a big splash, almost covering Isaac Rock, as a surfer comes in after a sunset session at Redgate Beach.",
    place: "redgate",
    caption:
      "A surfer coming ashore at Redgate Beach as swell explodes off the inshore rock, with Isaac Rock behind",
    body: [
      "The small inshore rock at Redgate takes swell out of all proportion to its size. When a set hits it squarely the spray goes up high enough to blot out Isaac Rock behind it, which is what has happened here, with a surfer walking in underneath.",
      "The picture is a straightforward demonstration of why this is a difficult coast. A rock that looks trivial at low tide is throwing water metres into the air, and the reef that does it is invisible from the beach. In 1876 the Georgette was put ashore into exactly this — an unlit, uncharted-in-detail surf coast with rock in the impact zone.",
    ],
  },
  "little-rock-in-winter-1": {
    standfirst: "Two surfers paddle past the little rock that packs a big punch.",
    place: "redgate",
    caption: "Two surfers paddling past the inshore rock at Redgate Beach in winter",
    body: [
      "Winter at Redgate, grey water, two surfers paddling out past the inshore rock. The same rock that throws spray over Isaac Rock in heavier conditions is, here, simply an obstacle to get around.",
      "This is the quietest picture in the Redgate group. It was kept in the collection as a control: proof of what this beach looks like on the great majority of days, against which the storm and sunset frames can be read as the exceptions they are.",
    ],
  },
  "contos-south-mound": {
    standfirst:
      "A daytime long exposure capturing the sea flowing over a granite mount at Contos South.",
    place: "contos",
    caption:
      "Daytime long exposure of the sea flowing over a granite mound at Contos South, Western Australia",
    body: [
      "A long exposure made in daylight, which requires heavy neutral density to hold the shutter open long enough for the water to move. What the technique does is separate the two things in the frame by their behaviour: the granite is absolutely still, and the sea, over the same seconds, becomes a single continuous flow across it.",
      "Photographed at normal shutter speeds this is a rock with waves hitting it. Held open, it becomes a picture about duration — how long the granite has been there against how briefly any particular piece of water is.",
    ],
  },
  "contos-dreaming-rock": {
    standfirst: "Dreamy seas just after a Contos sunset.",
    place: "contos",
    caption: "Long exposure of the sea around rocks at Contos just after sunset",
    body: [
      "Made in the short window after the sun has gone but before the colour drains out of the sky, when the light level has dropped far enough that a long exposure is possible without filtration.",
      "The sea goes to a smooth, low-contrast surface and the rocks sit in it without any visible waterline. The Contos frames were made alongside the Georgette work as part of the same ongoing survey of this coastline, and this is the softest of them.",
    ],
  },
};

/** Shared, deliberately brief — per-print copy above should dominate each page. */
export const PRINT_MAKING_NOTE =
  "Printed to order on Hahnemühle Photo Rag, a 100% cotton archival paper, and supplied with an edition number. Free shipping within Australia.";

export function getPrintEditorial(slug: string): PrintEditorial | null {
  return PRINT_EDITORIAL[slug] ?? null;
}

export function getPlaceContext(slug: string): PlaceContext | null {
  const editorial = PRINT_EDITORIAL[slug];
  return editorial ? PLACE_CONTEXT[editorial.place] : null;
}
