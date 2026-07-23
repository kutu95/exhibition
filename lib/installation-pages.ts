export type InstallationSlug = "cubarama" | "captain-godfrey" | "drift";

export type InstallationPageContent = {
  slug: InstallationSlug;
  path: string;
  title: string;
  eyebrow: string;
  metaDescription: string;
  imageKey: string;
  bodyKey: string;
  bodyFallbackKey: "cubarama" | "captain_godfrey" | "drift";
  summary: string;
  howItWorks: string[];
  technology: string[];
  forInstitutions: string[];
  requirements: string[];
  formats: string[];
};

export const installationPages: Record<InstallationSlug, InstallationPageContent> = {
  cubarama: {
    slug: "cubarama",
    path: "/installations/cubarama",
    title: "Cubarama",
    eyebrow: "360° immersive video · four-wall projection",
    metaDescription:
      "Cubarama is a four-wall 360° video installation that places visitors inside coastal footage from the SS Georgette sites. Available for galleries and museums to license, buy, or borrow.",
    imageKey: "installation_cubarama_image",
    bodyKey: "installation_cubarama",
    bodyFallbackKey: "cubarama",
    summary:
      "Cubarama turns a room into the coast. Four walls of projected video — water, rock, and sky from Calgardup Bay, Redgate Beach, and Isaac Rock — surround the visitor completely. There is no frame and no edge: the horizon is everywhere.",
    howItWorks: [
      "Visitors enter a dedicated room configured for continuous four-wall projection. Footage shot on location at the Georgette exhibition sites plays as a looping immersive environment, with coastal sound — wind, water, and the quiet of remote beaches.",
      "There is no headset and no controller. People stand, move, or sit as they like. The experience is open access during exhibition hours: enter and leave freely, with room capacity managed by venue staff.",
      "Cuborama Studio, a custom video editor built specifically for four-wall projection cinema, is used to author and synchronise the content — because conventional editors are not designed for that format.",
    ],
    technology: [
      "Four synchronised projection surfaces (or equivalent display walls) forming a closed room.",
      "Multi-channel video playback with spatial audio suited to an immersive coastal soundtrack.",
      "Content authored for four-wall cinema using Cuborama Studio, a purpose-built editor for this format.",
      "Designed for continuous public operation during gallery opening hours.",
    ],
    forInstitutions: [
      "Cubarama is suited to museums, galleries, and cultural venues that want an immersive coastal or site-specific environment without VR headsets or one-visitor-at-a-time hardware.",
      "The Georgette programme demonstrates a complete visitor-facing installation; the underlying approach — four-wall authored video, location-shot material, and room-scale immersion — can be adapted to other collections, places, or narratives.",
      "Institutions can enquire about licensing the Georgette Cubarama experience, commissioning a site-specific Cubarama programme, or discussing acquisition / loan of the playback and authoring toolchain.",
    ],
    requirements: [
      "A light-controlled room large enough for visitors to stand comfortably at the centre.",
      "Four projection or display walls with synchronised playback and adequate throw / brightness for ambient gallery conditions.",
      "Multi-channel audio; seating optional.",
      "Staffing for capacity and accessibility; wheelchair users can experience the projected environment without physical interaction.",
    ],
    formats: [
      "License the Georgette Cubarama experience for a fixed exhibition period",
      "Commission a Cubarama programme built from your own footage or collection",
      "Discuss purchase or loan of Cuborama Studio / playback configuration",
    ],
  },
  "captain-godfrey": {
    slug: "captain-godfrey",
    path: "/installations/captain-godfrey",
    title: "Captain Godfrey",
    eyebrow: "Interactive MetaHuman · conversational AI",
    metaDescription:
      "Captain Godfrey is a real-time interactive MetaHuman visitors can speak with — built from inquiry transcripts and historical research. Available for galleries and museums to license, buy, or borrow.",
    imageKey: "installation_captain_godfrey_image",
    bodyKey: "installation_captain_godfrey_ai",
    bodyFallbackKey: "captain_godfrey",
    summary:
      "Captain John Godfrey will speak with you. He stands in the weeks after the Busselton marine inquiry of December 1876: certificate suspended, reputation contested, memory still sharp. Ask about the night the Georgette went down, the lifeboat, Grace Bussell, Sam Isaacs — he answers in character, in real time.",
    howItWorks: [
      "The installation is a one-to-one conversation with a MetaHuman figure of Captain Godfrey, animated live. Visitors speak; he replies. Conversations typically last between five and fifteen minutes, with a small waiting area outside the space.",
      "He is not playing back fixed recordings. Character is informed by the Busselton marine inquiry transcript, Marcia van Zeller’s research in Cruel Capes, and passenger accounts such as George Leake’s. Every exchange is different.",
      "Voice and likeness are provided by a human performer (voice cloned for the character). An AI model stands in for the captain’s conversational mind, with the figure driven through a real-time graphics / game-engine stack on a high-end workstation.",
    ],
    technology: [
      "Unreal / MetaHuman (or equivalent) real-time character presentation.",
      "Speech input and conversational AI grounded in curated historical source material.",
      "AI voice cloning from a human performer, with live lip-sync / performance driving.",
      "Dedicated compute (high-end GPU workstation) and a controlled one-to-one visitor booth or alcove.",
    ],
    forInstitutions: [
      "Captain Godfrey demonstrates how contested historical figures can be encountered as interactive characters — useful for maritime museums, social-history galleries, and venues exploring AI as an interpretive tool rather than a gimmick.",
      "The Georgette build is historically specific; the same stack can be adapted to other figures where primary sources, ethical review, and performer consent are in place.",
      "Some of this sits in contested territory for art and heritage. The exhibition treats that openly: AI here builds the artist’s tools and the character’s voice and mind. Institutions interested in licensing, commissioning, or borrowing the system are invited to discuss scope, ethics, and technical fit.",
    ],
    requirements: [
      "A semi-private booth or alcove for one visitor at a time, with manageable ambient noise.",
      "Display suitable for a life-size or near life-size digital human, plus microphone / speaker arrangement for natural conversation.",
      "Dedicated high-end GPU computer and stable network as required by the conversational stack.",
      "Staff familiar with starting the session and assisting visitors; fully accessible for wheelchair users.",
    ],
    formats: [
      "License Captain Godfrey for a touring or fixed exhibition period",
      "Commission a new interactive historical character on the same technical stack",
      "Discuss purchase, partnership, or loan of the interactive MetaHuman system",
    ],
  },
  drift: {
    slug: "drift",
    path: "/installations/drift",
    title: "Drift",
    eyebrow: "Kinect · body-driven photographic display",
    metaDescription:
      "Drift is a Kinect-driven installation where visitors’ movement chooses which photographs appear. Available for galleries and museums to license, buy, or borrow.",
    imageKey: "installation_drift_image",
    bodyKey: "installation_drift",
    bodyFallbackKey: "drift",
    summary:
      "The photographs are on the screen. You move, and they move with you. Drift uses a depth camera so the visitor’s body becomes the interface: step left and the images follow; step closer and they open up; stand still and they settle.",
    howItWorks: [
      "Drift is open access throughout the day — no booking. A Kinect (or equivalent depth sensor) reads visitor movement in front of a large display of John Bowskill’s Georgette-site photographs.",
      "A custom application, built with AI assistance, selects which image to show and how it responds based on that movement. The point is not menu navigation; it is the physical relationship between looking and moving.",
      "Gallery staff can adjust sensitivity for a range of movement types, including visitors with limited mobility.",
    ],
    technology: [
      "Depth camera (Kinect-class) tracking visitor position and gesture in a defined floor zone.",
      "Custom playback application that maps movement to photographic selection and transitions.",
      "Large-format display or projection suitable for public gallery viewing.",
      "Configurable response curves for different accessibility and crowd conditions.",
    ],
    forInstitutions: [
      "Drift offers a low-friction interactive photography experience: no headsets, no handheld controllers, and throughput suited to busy open-studio or museum floors.",
      "The Georgette build uses a specific photographic series; the same movement-to-image system can be loaded with other collections where rights allow.",
      "Galleries and museums can enquire about licensing Drift with the Georgette images, commissioning a collection-specific build, or discussing acquisition / loan of the sensing and playback software.",
    ],
    requirements: [
      "Clear floor space in front of the display for visitors to move without obstructing circulation.",
      "Depth camera mounted with a stable view of the interaction zone; controlled lighting helps reliability.",
      "Large display or projection surface and a modest host computer for the custom app.",
      "Staff able to recalibrate the sensor and assist visitors; adjustable for limited mobility.",
    ],
    formats: [
      "License Drift with the Georgette photographic set",
      "Commission Drift for another photographic collection",
      "Discuss purchase or loan of the Kinect-driven playback application",
    ],
  },
};

export const installationPageList = Object.values(installationPages);
