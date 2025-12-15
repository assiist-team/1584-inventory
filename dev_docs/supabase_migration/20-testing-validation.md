# Task 8.3: Testing & Validation

## Objective
Comprehensively test the migrated application to ensure all functionality works correctly with Supabase.

## Testing Checklist

### Authentication Testing

- [ ] **Sign In with Google**
  - Can sign in successfully
  - User session persists after page reload
  - User data is created/updated in database

- [ ] **Sign Out**
  - Can sign out successfully
  - Session is cleared
  - Redirects to login page

- [ ] **Protected Routes**
  - Unauthenticated users are redirected to login
  - Authenticated users can access protected routes

- [ ] **First User Setup**
  - First user gets owner role
  - Default account is created
  - User is added to account as admin

- [ ] **User Invitations**
  - Can create invitations
  - Can accept invitations
  - Invited users are added to accounts correctly

### Account Management Testing

- [ ] **Account Creation**
  - Owners can create accounts
  - Account data is saved correctly

- [ ] **Account Membership**
  - Can add users to accounts
  - Can update user roles
  - Can remove users from accounts
  - Membership permissions work correctly

### Project Management Testing

- [ ] **Create Project**
  - Can create projects
  - Project data is saved correctly
  - Project appears in list

- [ ] **Read Projects**
  - Can list all projects for account
  - Projects are ordered correctly
  - Project counts are accurate

- [ ] **Update Project**
  - Can update project details
  - Updates are saved correctly

- [ ] **Delete Project**
  - Can delete projects
  - Project is removed from database

### Item Management Testing

- [ ] **Create Item**
  - Can create items
  - Item data is saved correctly
  - Item appears in list

- [ ] **Read Items**
  - Can list items for project
  - Filtering works (search, bookmark)
  - Pagination works
  - Sorting works

- [ ] **Update Item**
  - Can update item details
  - Can update item images
  - Bookmark toggle works

- [ ] **Delete Item**
  - Can delete items
  - Item is removed from database

### Transaction Management Testing

- [ ] **Create Transaction**
  - Can create transactions
  - Transaction data is saved correctly
  - Item allocation works

- [ ] **Read Transactions**
  - Can list transactions
  - Filtering works (status, reimbursement type)
  - Sorting works

- [ ] **Update Transaction**
  - Can update transaction details
  - Status updates work
  - Item allocation updates work

- [ ] **Delete Transaction**
  - Can delete transactions
  - Transaction is removed from database

### Image Upload Testing

- [ ] **Upload Item Images**
  - Can upload single image
  - Can upload multiple images
  - Progress tracking works (if implemented)
  - Images are accessible via public URL

- [ ] **Upload Transaction Images**
  - Can upload receipt images
  - Can upload other images
  - Images are accessible

- [ ] **Upload Business Logo**
  - Account admins can upload logos
  - Logos are accessible via public URL

- [ ] **Delete Images**
  - Can delete images
  - Images are removed from storage

### Business Profile Testing

- [ ] **Get Business Profile**
  - Can retrieve business profile
  - Profile data is correct

- [ ] **Update Business Profile**
  - Account admins can update profile
  - Logo updates work
  - Profile data is saved correctly

### Tax Presets Testing

- [ ] **Get Tax Presets**
  - Can retrieve tax presets
  - Default presets initialize correctly

- [ ] **Update Tax Presets**
  - Account admins can update presets
  - Validation works
  - Presets are saved correctly

### Real-time Features Testing

- [ ] **Project Updates**
  - Real-time updates work for projects
  - Changes appear without refresh

- [ ] **Item Updates**
  - Real-time updates work for items
  - Changes appear without refresh

- [ ] **Transaction Updates**
  - Real-time updates work for transactions
  - Changes appear without refresh

### Security Testing

- [ ] **Row Level Security**
  - Users can only access their account data
  - Account members can access account resources
  - Account admins have correct permissions
  - Owners have correct permissions
  - Unauthenticated users are blocked

- [ ] **Storage Policies**
  - Authenticated users can upload files
  - Account admins can upload business logos
  - Public read works for business logos
  - Unauthenticated uploads are blocked

### Performance Testing

- [ ] **Query Performance**
  - Queries are fast
  - Indexes are being used
  - No N+1 query problems

- [ ] **Real-time Performance**
  - Real-time updates are responsive
  - No excessive re-renders

### Error Handling Testing

- [ ] **Network Errors**
  - Handles network failures gracefully
  - Shows appropriate error messages

- [ ] **Authentication Errors**
  - Handles expired sessions
  - Handles invalid tokens

- [ ] **Validation Errors**
  - Form validation works
  - Database constraints are enforced

## Test Scenarios

### Scenario 1: New User Flow
1. Sign in as new user
2. Verify owner role assignment
3. Verify default account creation
4. Create a project
5. Add items to project
6. Create transactions

### Scenario 2: Multi-User Account
1. Owner creates account
2. Owner invites user
3. User accepts invitation
4. User creates project
5. Verify both users can see project
6. Verify permissions work correctly

### Scenario 3: Image Upload Flow
1. Create item
2. Upload multiple images
3. Verify images appear
4. Delete image
5. Verify image is removed

## Common Issues to Check

1. **Timestamp Conversion**
   - Dates display correctly
   - Date comparisons work
   - Timezone handling is correct

2. **JSONB Fields**
   - Images array works correctly
   - Details object works correctly
   - Presets array works correctly

3. **Array Fields**
   - Item IDs array works correctly
   - Array queries work

4. **Foreign Keys**
   - Cascading deletes work
   - Referential integrity maintained

## Verification
- [ ] All tests pass
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Application works end-to-end
- [ ] Performance is acceptable

## Next Steps
- Migration complete! 🎉
- Document any issues found
- Update documentation as needed

