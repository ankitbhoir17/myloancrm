function getRequestUserId(req) {
  return req?.user?._id || req?.user?.id || null;
}

function isAuditor(req) {
  return req?.user?.role === 'auditor';
}

function withOwnedRecords(req, filter = {}) {
  const userId = getRequestUserId(req);
  if (!isAuditor(req) || !userId) {
    return filter;
  }

  return {
    ...filter,
    createdBy: userId,
  };
}

function toOwnedPayload(req, payload = {}, existingRecord = null) {
  const ownerId = existingRecord?.createdBy || getRequestUserId(req);
  if (!ownerId) {
    return payload;
  }

  return {
    ...payload,
    createdBy: ownerId,
  };
}

module.exports = {
  getRequestUserId,
  isAuditor,
  withOwnedRecords,
  toOwnedPayload,
};
