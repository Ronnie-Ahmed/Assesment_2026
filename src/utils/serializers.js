export const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  interests: u.interests,
  createdAt: u.createdAt,
});