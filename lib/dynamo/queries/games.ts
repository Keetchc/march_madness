import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Tournament, Game, Team } from "../../types";

// ─── Tournament ───────────────────────────────────────────────────────────────

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Tournament) : null;
}

export async function upsertTournament(t: Tournament): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: { pk: `TOURNAMENT#${t.tournamentId}`, sk: "META", ...t },
    })
  );
}

export async function updateTournamentPicksSettings(
  tournamentId: string,
  updates: { lockDate?: string; picksOpenOverride?: boolean }
): Promise<void> {
  const parts: string[] = [];
  const values: Record<string, unknown> = {};
  if (updates.lockDate !== undefined) {
    parts.push("lockDate = :ld");
    values[":ld"] = updates.lockDate;
  }
  if (updates.picksOpenOverride !== undefined) {
    parts.push("picksOpenOverride = :po");
    values[":po"] = updates.picksOpenOverride;
  }
  if (parts.length === 0) return;
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: "META" },
      UpdateExpression: "SET " + parts.join(", "),
      ExpressionAttributeValues: values,
    })
  );
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getTeam(tournamentId: string, teamId: string): Promise<Team | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `TEAM#${teamId}` },
    })
  );
  return res.Item ? (res.Item as Team) : null;
}

export async function getAllTeams(tournamentId: string): Promise<Team[]> {
  const items: Team[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: TABLES.TOURNAMENT,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `TOURNAMENT#${tournamentId}`,
          ":prefix": "TEAM#",
        },
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...((res.Items ?? []) as Team[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

export async function upsertTeam(tournamentId: string, team: Team): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: {
        pk: `TOURNAMENT#${tournamentId}`,
        sk: `TEAM#${team.id}`,
        ...team,
      },
    })
  );
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function getGame(tournamentId: string, gameId: string): Promise<Game | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${gameId}` },
    })
  );
  return res.Item ? (res.Item as Game) : null;
}

export async function getAllGames(tournamentId: string): Promise<Game[]> {
  const items: Game[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: TABLES.TOURNAMENT,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `TOURNAMENT#${tournamentId}`,
          ":prefix": "GAME#",
        },
        ExclusiveStartKey: startKey,
      })
    );
    items.push(...((res.Items ?? []) as Game[]));
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

export async function upsertGame(tournamentId: string, game: Game): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.TOURNAMENT,
      Item: {
        pk: `TOURNAMENT#${tournamentId}`,
        sk: `GAME#${game.gameId}`,
        ...game,
      },
    })
  );
}

export async function setGameResult(
  tournamentId: string,
  gameId: string,
  winnerId: string,
  score1: number,
  score2: number
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${gameId}` },
      UpdateExpression:
        "SET winnerId = :w, score1 = :s1, score2 = :s2, #st = :st, completedAt = :ca",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":w":  winnerId,
        ":s1": score1,
        ":s2": score2,
        ":st": "final",
        ":ca": new Date().toISOString(),
      },
    })
  );
}

// Advance winner into the next game's team slot
export async function advanceWinner(
  tournamentId: string,
  nextGameId: string,
  nextGameSlot: 1 | 2,
  teamId: string
): Promise<void> {
  const field = nextGameSlot === 1 ? "team1Id" : "team2Id";
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.TOURNAMENT,
      Key: { pk: `TOURNAMENT#${tournamentId}`, sk: `GAME#${nextGameId}` },
      UpdateExpression: `SET ${field} = :t`,
      ExpressionAttributeValues: { ":t": teamId },
    })
  );
}

// Find a game by its ESPN ID (used during polling sync)
export async function getGameByEspnId(
  tournamentId: string,
  espnGameId: string
): Promise<Game | null> {
  const all = await getAllGames(tournamentId);
  return all.find((g) => g.espnGameId === espnGameId) ?? null;
}

