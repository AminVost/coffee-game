import { z } from "zod";
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  tournamentRegistrationWindowError
} from "@/lib/tournament-definition";

const nullableDate = z.union([z.string().datetime(), z.null()]).optional();

export const tournamentInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
  subtitle: z.string().trim().max(255).optional(),
  description: z.string().trim().max(10000).optional(),
  gameId: z.number().int().positive(),
  templateId: z.number().int().positive().nullable().optional(),
  venueId: z.number().int().positive().nullable().optional(),
  format: z.enum(TOURNAMENT_FORMATS),
  participantType: z.enum(["INDIVIDUAL", "TEAM"]),
  teamSize: z.number().int().min(1).max(20),
  capacity: z.number().int().min(2).max(5000),
  minParticipants: z.number().int().min(2).max(5000).default(2),
  price: z.number().int().min(0),
  status: z.enum(TOURNAMENT_STATUSES),
  registrationStartsAt: nullableDate,
  registrationEndsAt: nullableDate,
  startsAt: z.string().datetime(),
  endsAt: nullableDate,
  reservationExpiresMin: z.number().int().min(5).max(1440),
  lateToleranceMin: z.number().int().min(0).max(180),
  waitlistMode: z.enum(["disabled", "offer", "manual", "automatic"]),
  allowMultiSlot: z.boolean(),
  hasThirdPlace: z.boolean(),
  drawMode: z.enum(["random", "seeded", "custom"]),
  rules: z.array(z.string().trim().min(1).max(500)).max(100),
  gameSettings: z.record(z.string(), z.unknown()).default({}),
  scoringSettings: z.record(z.string(), z.unknown()).default({}),
  notificationSettings: z.record(z.string(), z.unknown()).default({}),
  cancellationSettings: z.record(z.string(), z.unknown()).default({}),
  prizeSettings: z.record(z.string(), z.unknown()).default({}),
  coverImageUrl: z.string().trim().max(500).nullable().optional(),
  isFeatured: z.boolean().default(false)
}).superRefine((value, context) => {
  if (value.participantType === "INDIVIDUAL" && value.teamSize !== 1) {
    context.addIssue({
      code: "custom",
      path: ["teamSize"],
      message: "اندازه تیم در مسابقه انفرادی باید ۱ باشد."
    });
  }
  if (value.minParticipants > value.capacity) {
    context.addIssue({
      code: "custom",
      path: ["minParticipants"],
      message: "حداقل شرکت‌کننده نمی‌تواند بیشتر از ظرفیت باشد."
    });
  }

  const registrationError = tournamentRegistrationWindowError(value);
  if (registrationError) {
    context.addIssue({
      code: "custom",
      path: ["registrationEndsAt"],
      message: registrationError
    });
  }

  const start = new Date(value.startsAt).getTime();
  const end = value.endsAt ? new Date(value.endsAt).getTime() : null;
  if (end !== null && end <= start) {
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "پایان مسابقه باید بعد از شروع آن باشد."
    });
  }
});

export type TournamentInput = z.infer<typeof tournamentInputSchema>;
