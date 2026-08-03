import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

const FINAL_STATUSES = new Set(["CONFIRMED", "CHECKED_IN"]);
const PENDING_STATUSES = new Set([
  "RESERVED",
  "PENDING_PAYMENT",
  "PENDING_APPROVAL",
  "NEEDS_CORRECTION"
]);

export type ParticipantBlocker = {
  code: string;
  message: string;
};

export type FinalRegistration = {
  id: number;
  publicId: string;
  status: string;
  slots: number;
  contactMobile: string | null;
  paymentStatus: string | null;
  entries: Array<{
    id: number;
    playerId: number | null;
    teamId: number | null;
    name: string;
    mobile: string | null;
    seed: number | null;
    confirmedAt: Date | null;
    teamMemberCount: number;
    teamMemberIds: number[];
    teamMemberNames: string[];
  }>;
};

export type TournamentParticipantInspection = {
  tournament: {
    id: number;
    title: string;
    status: string;
    participantType: "INDIVIDUAL" | "TEAM";
    teamSize: number;
    capacity: number;
    minimumParticipants: number;
  };
  finalRegistrations: FinalRegistration[];
  pendingRegistrations: FinalRegistration[];
  finalUnits: number;
  pendingCount: number;
  activeHolds: number;
  activeWaitlist: number;
  drawExists: boolean;
  blockers: ParticipantBlocker[];
  readyForDraw: boolean;
};

type TournamentRow = RowDataPacket & {
  id: number;
  title: string;
  status: string;
  participant_type: "INDIVIDUAL" | "TEAM";
  team_size: number;
  capacity: number;
  min_participants: number;
};

type RegistrationEntryRow = RowDataPacket & {
  registration_id: number;
  public_id: string;
  registration_status: string;
  slots: number;
  contact_mobile: string | null;
  payment_status: string | null;
  entry_id: number | null;
  player_id: number | null;
  team_id: number | null;
  seed: number | null;
  confirmed_at: Date | null;
  entry_name: string | null;
  entry_mobile: string | null;
  team_member_count: number | null;
  team_member_ids: string | null;
  team_member_names: string | null;
};

type CountRow = RowDataPacket & { total: number };

function splitIds(value: string | null) {
  if (!value) return [];
  return value.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

function splitNames(value: string | null) {
  if (!value) return [];
  return value.split("،").map((name) => name.trim()).filter(Boolean);
}

function registrationMap(rows: RegistrationEntryRow[]) {
  const registrations = new Map<number, FinalRegistration>();

  for (const row of rows) {
    let registration = registrations.get(Number(row.registration_id));
    if (!registration) {
      registration = {
        id: Number(row.registration_id),
        publicId: row.public_id,
        status: row.registration_status,
        slots: Number(row.slots),
        contactMobile: row.contact_mobile,
        paymentStatus: row.payment_status,
        entries: []
      };
      registrations.set(registration.id, registration);
    }

    if (row.entry_id) {
      registration.entries.push({
        id: Number(row.entry_id),
        playerId: row.player_id ? Number(row.player_id) : null,
        teamId: row.team_id ? Number(row.team_id) : null,
        name: row.entry_name || "بدون نام",
        mobile: row.entry_mobile,
        seed: row.seed === null ? null : Number(row.seed),
        confirmedAt: row.confirmed_at,
        teamMemberCount: Number(row.team_member_count || 0),
        teamMemberIds: splitIds(row.team_member_ids),
        teamMemberNames: splitNames(row.team_member_names)
      });
    }
  }

  return [...registrations.values()];
}

function addBlocker(blockers: ParticipantBlocker[], code: string, message: string) {
  if (!blockers.some((item) => item.code === code)) blockers.push({ code, message });
}

export async function inspectTournamentParticipants(
  connection: PoolConnection,
  tournamentId: number
): Promise<TournamentParticipantInspection | null> {
  const [tournamentRows] = await connection.query<TournamentRow[]>(`
    SELECT id,title,status,participant_type,team_size,capacity,min_participants
    FROM tournaments
    WHERE id=? AND deleted_at IS NULL
    LIMIT 1
  `, [tournamentId]);
  const tournament = tournamentRows[0];
  if (!tournament) return null;

  const [entryRows] = await connection.query<RegistrationEntryRow[]>(`
    SELECT
      registration.id AS registration_id,
      registration.public_id,
      registration.status AS registration_status,
      registration.slots,
      registration.contact_mobile,
      payment.status AS payment_status,
      entry.id AS entry_id,
      entry.player_id,
      entry.team_id,
      entry.seed,
      entry.confirmed_at,
      COALESCE(player.name,team.title) AS entry_name,
      player.mobile AS entry_mobile,
      team_info.member_count AS team_member_count,
      team_info.member_ids AS team_member_ids,
      team_info.member_names AS team_member_names
    FROM registrations registration
    LEFT JOIN registration_entries entry ON entry.registration_id=registration.id
    LEFT JOIN players player ON player.id=entry.player_id
    LEFT JOIN teams team ON team.id=entry.team_id
    LEFT JOIN (
      SELECT
        member.team_id,
        COUNT(*) AS member_count,
        GROUP_CONCAT(member.player_id ORDER BY member.player_id SEPARATOR ',') AS member_ids,
        GROUP_CONCAT(COALESCE(team_player.name,'بدون نام') ORDER BY member.joined_at,member.player_id SEPARATOR '،') AS member_names
      FROM team_members member
      JOIN players team_player ON team_player.id=member.player_id
      GROUP BY member.team_id
    ) team_info ON team_info.team_id=entry.team_id
    LEFT JOIN payments payment ON payment.id=(
      SELECT latest.id
      FROM payments latest
      WHERE latest.registration_id=registration.id
      ORDER BY latest.id DESC
      LIMIT 1
    )
    WHERE registration.tournament_id=?
      AND registration.deleted_at IS NULL
    ORDER BY registration.created_at,registration.id,entry.id
  `, [tournamentId]);

  const [holdRows, waitlistRows, drawRows] = await Promise.all([
    connection.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM registration_holds
      WHERE tournament_id=? AND status='ACTIVE' AND expires_at>NOW()
    `, [tournamentId]),
    connection.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM waitlist_entries
      WHERE tournament_id=?
        AND (
          status='WAITING'
          OR (status='OFFERED' AND offer_expires_at>NOW())
        )
    `, [tournamentId]),
    connection.query<CountRow[]>(`
      SELECT COUNT(*) AS total FROM tournament_matches WHERE tournament_id=?
    `, [tournamentId])
  ]);

  const registrations = registrationMap(entryRows);
  const finalRegistrations = registrations.filter((item) => FINAL_STATUSES.has(item.status));
  const pendingRegistrations = registrations.filter((item) => PENDING_STATUSES.has(item.status));
  const activeHolds = Number(holdRows[0][0]?.total || 0);
  const activeWaitlist = Number(waitlistRows[0][0]?.total || 0);
  const drawExists = Number(drawRows[0][0]?.total || 0) > 0;
  const blockers: ParticipantBlocker[] = [];
  const participantKeys = new Set<string>();
  const teamMemberOwners = new Map<number, string>();

  if (!["REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(tournament.status)) {
    addBlocker(
      blockers,
      "INVALID_TOURNAMENT_STATUS",
      "نهایی‌سازی فقط وقتی ممکن است که ثبت‌نام باز یا بسته باشد."
    );
  }
  if (drawExists) {
    addBlocker(blockers, "DRAW_EXISTS", "قرعه قبلاً ساخته شده و فهرست شرکت‌کنندگان قفل است.");
  }
  if (pendingRegistrations.length) {
    addBlocker(
      blockers,
      "PENDING_REGISTRATIONS",
      `${pendingRegistrations.length.toLocaleString("fa-IR")} ثبت‌نام هنوز از نظر پرداخت تعیین تکلیف نشده است.`
    );
  }
  if (activeHolds) {
    addBlocker(
      blockers,
      "ACTIVE_HOLDS",
      `${activeHolds.toLocaleString("fa-IR")} رزرو موقت فعال وجود دارد.`
    );
  }
  if (activeWaitlist) {
    addBlocker(
      blockers,
      "ACTIVE_WAITLIST",
      `${activeWaitlist.toLocaleString("fa-IR")} رکورد فعال در صف انتظار وجود دارد.`
    );
  }

  for (const registration of finalRegistrations) {
    if (registration.paymentStatus !== "APPROVED") {
      addBlocker(
        blockers,
        "PAYMENT_MISMATCH",
        "حداقل یک ثبت‌نام قطعی، پرداخت تأییدشده ندارد."
      );
    }

    if (tournament.participant_type === "INDIVIDUAL") {
      if (registration.entries.length !== registration.slots) {
        addBlocker(
          blockers,
          "ENTRY_COUNT_MISMATCH",
          "تعداد بازیکنان یکی از ثبت‌نام‌های انفرادی با تعداد سهم‌های آن برابر نیست."
        );
      }
      for (const entry of registration.entries) {
        if (!entry.playerId || entry.teamId) {
          addBlocker(blockers, "INVALID_ENTRY", "حداقل یک ورودی انفرادی اطلاعات بازیکن معتبر ندارد.");
          continue;
        }
        const key = `p:${entry.playerId}`;
        if (participantKeys.has(key)) {
          addBlocker(blockers, "DUPLICATE_PARTICIPANT", "یک بازیکن بیش از یک بار در فهرست نهایی قرار گرفته است.");
        }
        participantKeys.add(key);
      }
    } else {
      if (registration.slots !== 1 || registration.entries.length !== 1) {
        addBlocker(
          blockers,
          "TEAM_ENTRY_COUNT_MISMATCH",
          "هر ثبت‌نام تیمی باید دقیقاً شامل یک تیم باشد."
        );
      }
      for (const entry of registration.entries) {
        if (!entry.teamId || entry.playerId) {
          addBlocker(blockers, "INVALID_TEAM_ENTRY", "حداقل یک ورودی تیمی اطلاعات تیم معتبر ندارد.");
          continue;
        }
        const teamKey = `t:${entry.teamId}`;
        if (participantKeys.has(teamKey)) {
          addBlocker(blockers, "DUPLICATE_TEAM", "یک تیم بیش از یک بار در فهرست نهایی قرار گرفته است.");
        }
        participantKeys.add(teamKey);
        if (entry.teamMemberCount !== Number(tournament.team_size)) {
          addBlocker(
            blockers,
            "TEAM_SIZE_MISMATCH",
            `حداقل یک تیم دقیقاً ${Number(tournament.team_size).toLocaleString("fa-IR")} عضو ندارد.`
          );
        }
        for (const memberId of entry.teamMemberIds) {
          const owner = teamMemberOwners.get(memberId);
          if (owner && owner !== teamKey) {
            addBlocker(
              blockers,
              "DUPLICATE_TEAM_MEMBER",
              "یک بازیکن در بیش از یک تیم نهایی حضور دارد."
            );
          }
          teamMemberOwners.set(memberId, teamKey);
        }
      }
    }
  }

  const finalUnits = tournament.participant_type === "TEAM"
    ? finalRegistrations.reduce((sum, item) => sum + item.entries.filter((entry) => entry.teamId).length, 0)
    : finalRegistrations.reduce((sum, item) => sum + item.entries.filter((entry) => entry.playerId).length, 0);

  if (finalUnits < Math.max(2, Number(tournament.min_participants))) {
    addBlocker(
      blockers,
      "MINIMUM_NOT_REACHED",
      `تعداد نهایی شرکت‌کنندگان (${finalUnits.toLocaleString("fa-IR")}) از حداقل مسابقه کمتر است.`
    );
  }
  if (finalUnits > Number(tournament.capacity)) {
    addBlocker(blockers, "CAPACITY_EXCEEDED", "تعداد نهایی شرکت‌کنندگان از ظرفیت مسابقه بیشتر است.");
  }

  return {
    tournament: {
      id: Number(tournament.id),
      title: tournament.title,
      status: tournament.status,
      participantType: tournament.participant_type,
      teamSize: Number(tournament.team_size),
      capacity: Number(tournament.capacity),
      minimumParticipants: Number(tournament.min_participants)
    },
    finalRegistrations,
    pendingRegistrations,
    finalUnits,
    pendingCount: pendingRegistrations.length,
    activeHolds,
    activeWaitlist,
    drawExists,
    blockers,
    readyForDraw: tournament.status === "REGISTRATION_CLOSED" && blockers.length === 0
  };
}
