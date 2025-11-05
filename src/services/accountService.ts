import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore'
import { db, convertTimestamps } from './firebase'
import { Account, AccountMembership } from '@/types'

/**
 * Account Service - Manages account creation, membership, and role management
 */
export const accountService = {
  /**
   * Create a new account (owners only)
   */
  async createAccount(name: string, createdBy: string): Promise<string> {
    const accountsRef = collection(db, 'accounts')
    const accountRef = doc(accountsRef)
    
    const accountData: Account = {
      id: accountRef.id,
      name,
      createdAt: new Date(),
      createdBy
    }

    await setDoc(accountRef, {
      ...accountData,
      createdAt: serverTimestamp()
    })

    return accountRef.id
  },

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<Account | null> {
    const accountRef = doc(db, 'accounts', accountId)
    const accountSnap = await getDoc(accountRef)

    if (accountSnap.exists()) {
      const data = convertTimestamps(accountSnap.data())
      return {
        id: accountSnap.id,
        ...data
      } as Account
    }
    return null
  },

  /**
   * Get account for a user (from user's accountId field)
   */
  async getUserAccount(userId: string): Promise<Account | null> {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)

    if (userSnap.exists()) {
      const userData = userSnap.data()
      const accountId = userData.accountId

      if (accountId) {
        return await this.getAccount(accountId)
      }
    }
    return null
  },

  /**
   * Get user's role in a specific account
   */
  async getUserRoleInAccount(userId: string, accountId: string): Promise<'admin' | 'user' | null> {
    const membershipRef = doc(db, 'accounts', accountId, 'members', userId)
    const membershipSnap = await getDoc(membershipRef)

    if (membershipSnap.exists()) {
      const data = membershipSnap.data() as AccountMembership
      return data.role
    }
    return null
  },

  /**
   * Add user to account with a role
   */
  async addUserToAccount(
    userId: string,
    accountId: string,
    role: 'admin' | 'user'
  ): Promise<void> {
    const membershipRef = doc(db, 'accounts', accountId, 'members', userId)
    
    const membershipData: AccountMembership = {
      userId,
      accountId,
      role,
      joinedAt: new Date()
    }

    await setDoc(membershipRef, {
      ...membershipData,
      joinedAt: serverTimestamp()
    })
  },

  /**
   * Update user's role in account (owner or account admin only)
   */
  async updateUserRoleInAccount(
    userId: string,
    accountId: string,
    role: 'admin' | 'user'
  ): Promise<void> {
    const membershipRef = doc(db, 'accounts', accountId, 'members', userId)
    
    await updateDoc(membershipRef, {
      role,
      joinedAt: serverTimestamp() // Update timestamp on role change
    })
  },

  /**
   * Remove user from account
   */
  async removeUserFromAccount(userId: string, accountId: string): Promise<void> {
    const membershipRef = doc(db, 'accounts', accountId, 'members', userId)
    await deleteDoc(membershipRef)
  },

  /**
   * Get all members of an account
   */
  async getAccountMembers(accountId: string): Promise<AccountMembership[]> {
    const membersRef = collection(db, 'accounts', accountId, 'members')
    const membersSnapshot = await getDocs(membersRef)

    return membersSnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data())
      return {
        userId: doc.id,
        ...data
      } as AccountMembership
    })
  },

  /**
   * Check if user is member of account
   */
  async isAccountMember(userId: string, accountId: string): Promise<boolean> {
    const membershipRef = doc(db, 'accounts', accountId, 'members', userId)
    const membershipSnap = await getDoc(membershipRef)
    return membershipSnap.exists()
  }
}

