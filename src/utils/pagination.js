import mongoose from 'mongoose';

// Returns null when the cursor is invalid, so the controller can answer 400.
export function parsePagination(query) {
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 10;
  limit = Math.min(limit, 50);

  const filter = {};
  if (query.cursor) {
    if (!mongoose.isValidObjectId(query.cursor)) return null;
    filter._id = { $lt: query.cursor };
  }
  return { limit, filter };
}

// Expects docs fetched with limit + 1, to detect whether another page exists.
export function buildPage(docs, limit) {
  const hasMore = docs.length > limit;
  const data = hasMore ? docs.slice(0, limit) : docs;
  return {
    data,
    nextCursor: hasMore ? data[data.length - 1]._id : null,
    limit,
  };
}