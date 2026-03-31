import { query } from '../config/database.js';

export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('📋 Getting current user:', userId);

    // Get user details
    const userResult = await query(
      'SELECT user_id, username, email, full_name, phone, role, department, is_active FROM users WHERE user_id = ?',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    console.log('✅ User found:', user.username);

    // Get user permissions
    const permResult = await query(
      `SELECT p.permission_id, p.name, p.description, p.resource, p.action
       FROM permissions p
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.role = ?`,
      [user.role]
    );

    const permissions = permResult.rows || [];
    console.log('✅ Permissions loaded:', permissions.length, 'items');

    res.json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      department: user.department,
      is_active: user.is_active,
      permissions: permissions,
    });
  } catch (error) {
    console.error('❌ Error in getCurrentUser:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
};

export const getUserPermissions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log('🔐 Getting permissions for user:', userId);

    // Get user role first
    const userResult = await query(
      'SELECT role FROM users WHERE user_id = ?',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRole = userResult.rows[0].role;

    // Get permissions for this role
    const permResult = await query(
      `SELECT p.permission_id, p.name, p.description, p.resource, p.action
       FROM permissions p
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.role = ?`,
      [userRole]
    );

    const permissions = permResult.rows || [];
    console.log('✅ Found', permissions.length, 'permissions for role:', userRole);

    res.json({
      role: userRole,
      permissions: permissions,
      permission_count: permissions.length,
    });
  } catch (error) {
    console.error('❌ Error in getUserPermissions:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { full_name, phone, department } = req.body;

    console.log('✏️ Updating profile for user:', userId);

    const result = await query(
      'UPDATE users SET full_name = ?, phone = ?, department = ? WHERE user_id = ?',
      [full_name, phone, department, userId]
    );

    if (result.changes === 0) {
      console.log('❌ No changes made');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ Profile updated');
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};