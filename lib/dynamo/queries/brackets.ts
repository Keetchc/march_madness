import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../client";
import { TABLES } from "../tables";
import type { Bracket, Picks } from "../../types";

export async function getBracket(bracketId: string): Promise<Bracket | null> {
  const res = await dynamo.send(
    new GetCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
    })
  );
  return res.Item ? (res.Item as Bracket) : null;
}

export async function getBracketsByUser(userId: string): Promise<Bracket[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.BRACKETS,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );
  return (res.Items ?? []) as Bracket[];
}

export async function getBracketsByTournament(tournamentId: string): Promise<Bracket[]> {
  const res = await dynamo.send(
    new QueryCommand({
      TableName: TABLES.BRACKETS,
      IndexName: "tournamentId-index",
      KeyConditionExpression: "tournamentId = :tid",
      ExpressionAttributeValues: { ":tid": tournamentId },
    })
  );
  return (res.Items ?? []) as Bracket[];
}

export async function createBracket(bracket: Bracket): Promise<void> {
  await dynamo.send(
    new PutCommand({
      TableName: TABLES.BRACKETS,
      Item: {
        pk: `BRACKET#${bracket.bracketId}`,
        sk: "META",
        ...bracket,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    })
  );
}

export async function updatePicks(
  bracketId: string,
  picks: Picks
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
      UpdateExpression: "SET picks = :p, updatedAt = :u",
      ExpressionAttributeValues: {
        ":p": picks,
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function updateScore(
  bracketId: string,
  score: number,
  maxPossibleScore: number,
  isEliminated: boolean
): Promise<void> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
      UpdateExpression:
        "SET score = :s, maxPossibleScore = :m, isEliminated = :e, updatedAt = :u",
      ExpressionAttributeValues: {
        ":s": score,
        ":m": maxPossibleScore,
        ":e": isEliminated,
        ":u": new Date().toISOString(),
      },
    })
  );
}

export async function deleteBracket(bracketId: string): Promise<void> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLES.BRACKETS,
      Key: { pk: `BRACKET#${bracketId}`, sk: "META" },
    })
  );
}

