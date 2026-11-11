export const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  interests: u.interests,
  createdAt: u.createdAt,
});

export const publicNote = (n) => ({
  id: n._id,
  title: n.title,
  content: n.content,
  owner: n.owner?._id ?? n.owner,
  ownerName: n.owner?.name,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

export const publicPost = (p) => ({
  id: p._id,
  title: p.title,
  content: p.content,
  author: p.author?._id ?? p.author,
  authorName: p.author?.name,
  createdAt: p.createdAt,
});