import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_IMAGE_PREFIX,
  emailDerivativeFilename,
  localImagesFilename,
} from "../lib/campaigns/email-image";

describe("localImagesFilename", () => {
  it("accepts relative /images paths", () => {
    expect(localImagesFilename("/images/portrait.jpg")).toBe("portrait.jpg");
  });

  it("rejects external hosts and non-image paths", () => {
    expect(localImagesFilename("https://cdn.example.com/images/a.jpg")).toBeNull();
    expect(localImagesFilename("/video/clip.mp4")).toBeNull();
    expect(localImagesFilename("")).toBeNull();
  });

  it("rejects already-optimized email derivatives", () => {
    expect(localImagesFilename(`/images/${EMAIL_IMAGE_PREFIX}portrait.jpg`)).toBeNull();
  });

  it("accepts same-origin absolute URLs", () => {
    expect(localImagesFilename("https://exhibition.margies.app/images/portrait.jpg")).toBe(
      "portrait.jpg",
    );
  });
});

describe("emailDerivativeFilename", () => {
  it("forces jpeg extension under the email prefix", () => {
    expect(emailDerivativeFilename("hero.png")).toBe(`${EMAIL_IMAGE_PREFIX}hero.jpg`);
  });
});

describe("resolveEmailImageUrl", () => {
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), "email-image-"));
    process.env.WEB_MEDIA_DIR = mediaRoot;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.WEB_MEDIA_DIR;
    await fs.rm(mediaRoot, { recursive: true, force: true });
  });

  it("writes a cached smaller jpeg and leaves the master untouched", async () => {
    const imagesDir = path.join(mediaRoot, "images");
    await fs.mkdir(imagesDir, { recursive: true });
    const masterName = "heavy-master.jpg";
    const masterPath = path.join(imagesDir, masterName);

    await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .jpeg({ quality: 95 })
      .toFile(masterPath);

    const masterBefore = await fs.readFile(masterPath);
    const { resolveEmailImageUrl: resolve } = await import("../lib/campaigns/email-image");
    const url = await resolve(`/images/${masterName}`);

    expect(url).toBe(`/images/${EMAIL_IMAGE_PREFIX}heavy-master.jpg`);
    const masterAfter = await fs.readFile(masterPath);
    expect(masterAfter.equals(masterBefore)).toBe(true);

    const derivativePath = path.join(imagesDir, `${EMAIL_IMAGE_PREFIX}heavy-master.jpg`);
    const meta = await sharp(derivativePath).metadata();
    expect(meta.width).toBeLessThanOrEqual(1200);
    expect(meta.format).toBe("jpeg");

    const masterStat = await fs.stat(masterPath);
    const derivativeStat = await fs.stat(derivativePath);
    expect(derivativeStat.size).toBeLessThan(masterStat.size);
  });

  it("leaves external URLs unchanged", async () => {
    const { resolveEmailImageUrl: resolve } = await import("../lib/campaigns/email-image");
    await expect(resolve("https://cdn.example.com/pic.jpg")).resolves.toBe(
      "https://cdn.example.com/pic.jpg",
    );
  });

  it("rewrites image and product blocks", async () => {
    const imagesDir = path.join(mediaRoot, "images");
    await fs.mkdir(imagesDir, { recursive: true });
    await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: "#112233" },
    })
      .jpeg()
      .toFile(path.join(imagesDir, "block-src.jpg"));

    const { prepareCampaignBlocksForEmail: prepare } = await import("../lib/campaigns/email-image");
    const prepared = await prepare([
      {
        id: "1",
        type: "image",
        url: "/images/block-src.jpg",
        alt: "Alt",
      },
      {
        id: "2",
        type: "product",
        product_id: "11111111-1111-4111-8111-111111111111",
        slug: "rock",
        title: "Rock",
        image_url: "/images/block-src.jpg",
        cta_label: "View",
      },
      {
        id: "3",
        type: "heading",
        text: "Hello",
      },
    ]);

    expect(prepared[0]).toMatchObject({ type: "image", url: `/images/${EMAIL_IMAGE_PREFIX}block-src.jpg` });
    expect(prepared[1]).toMatchObject({
      type: "product",
      image_url: `/images/${EMAIL_IMAGE_PREFIX}block-src.jpg`,
    });
    expect(prepared[2]).toMatchObject({ type: "heading", text: "Hello" });
  });
});
