/**
 * Splits site_content text for installation bodies into paragraph blocks.
 * In admin, use a blank line between paragraphs.
 */
export function splitInstallationBody(text: string | null | undefined): string[] {
  if (!text?.trim()) {
    return [];
  }
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const installationBodyFallback: Record<"cubarama" | "captain_godfrey" | "drift", string> = {
  cubarama: [
    "You enter a room and the room becomes the coast. Four walls of projected video — the water, the rock, the sky at Calgardup Bay, Redgate Beach, Isaac Rock — surround you completely. There is no frame. There is no edge. The horizon is everywhere.",
    "Cubarama is a four-wall 360° video installation. The footage was shot on location at the exhibition sites. Standing at the centre of the room, you are standing at the centre of the place where the Georgette went down. The sound is the sound of the coast — wind, water, the particular silence of remote beaches in the early morning. You can stay as long as you like.",
  ].join("\n\n"),
  captain_godfrey: [
    "Captain John Godfrey will speak with you. He is standing in the weeks following the Busselton marine inquiry of December 1876. His certificate of competency has been suspended for eighteen months. A manslaughter charge is before the courts. Fremantle, where he lives, is a port town with a long memory.",
    "Ask him about the night the Georgette went down. Ask him about the lifeboat. Ask him about William Dundee, his first officer, on whose incompetence he places significant blame. Ask him about Grace Bussell and Sam Isaacs. He will answer every question — in his own way, in his own register, with the pride and guardedness of a man who believes absolutely that he has been made a scapegoat.",
    "Captain Godfrey AI is a real-time interactive digital human — a MetaHuman figure animated live by artificial intelligence. His voice was recorded and cloned from a human performer. His character is built from the marine inquiry transcript, from Marcia van Zeller's historical research in Cruel Capes, and from the firsthand passenger account of George Leake. He is not playing back recordings. Every conversation is different.",
    "Voice and likeness provided by a human performer. Character informed by the Busselton marine inquiry transcript (December 1876), Cruel Capes by Marcia van Zeller (Curtin University, 2014), and the letters of George Leake (State Records Office of Western Australia).",
  ].join("\n\n"),
  drift: [
    "The photographs are on the screen. You move, and they move with you. Drift is a Kinect-driven interactive display — your body becomes the interface. Step left and the images follow. Step closer and they open up. Stand still and they settle.",
    "The experience is not about navigation. It is about the relationship between a body and an image — the way looking at a photograph is never entirely passive. In Drift, that relationship becomes physical. The photographs are John Bowskill's images of the Georgette sites. The movement is yours.",
  ].join("\n\n"),
};

export function getInstallationBody(
  fromDb: string | null | undefined,
  which: keyof typeof installationBodyFallback,
): { paragraphs: string[]; noteParagraphIndex: number | null } {
  const fromDbTrimmed = fromDb?.trim();
  if (fromDbTrimmed) {
    return {
      paragraphs: splitInstallationBody(fromDbTrimmed),
      noteParagraphIndex: null,
    };
  }
  const merged = splitInstallationBody(installationBodyFallback[which]);
  if (which === "captain_godfrey" && merged.length > 0) {
    return {
      paragraphs: merged,
      noteParagraphIndex: merged.length - 1,
    };
  }
  return { paragraphs: merged, noteParagraphIndex: null };
}
