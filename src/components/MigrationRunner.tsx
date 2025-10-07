import React, { useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, getFirestore } from 'firebase/firestore'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'

interface MigrationResult {
  projectsProcessed: number
  itemsMigrated: number
}

export default function MigrationRunner() {
  const { user } = useAuth()
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<{ projects: number; totalItems: number } | null>(null)

  const db = getFirestore()

  const validateMigration = async () => {
    try {
      setError(null)
      const projectsRef = collection(db, 'projects')
      const projectsSnapshot = await getDocs(projectsRef)

      let totalItems = 0
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id
        const itemsRef = collection(db, 'projects', projectId, 'items')
        const itemsSnapshot = await getDocs(itemsRef)
        totalItems += itemsSnapshot.docs.length
      }

      setValidation({
        projects: projectsSnapshot.docs.length,
        totalItems: totalItems
      })

      return true
    } catch (error) {
      setError(`Validation failed: ${error}`)
      return false
    }
  }

  const runMigration = async () => {
    if (!user) {
      setError('You must be authenticated to run migration')
      return
    }

    try {
      setIsRunning(true)
      setError(null)

      console.log('🚀 Starting migration...')

      // Get all projects
      const projectsRef = collection(db, 'projects')
      const projectsSnapshot = await getDocs(projectsRef)

      if (projectsSnapshot.empty) {
        setError('No projects found to migrate')
        return
      }

      let totalItemsMigrated = 0
      let totalProjectsProcessed = 0

      // Process each project
      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id
        const projectData = projectDoc.data()

        console.log(`Processing project: ${projectData.name || projectId}`)

        // Get all items for this project
        const itemsRef = collection(db, 'projects', projectId, 'items')
        const itemsSnapshot = await getDocs(itemsRef)

        if (itemsSnapshot.empty) continue

        // Migrate items in batches
        const batchSize = 10
        for (let i = 0; i < itemsSnapshot.docs.length; i += batchSize) {
          const batch = writeBatch(db)
          const batchItems = itemsSnapshot.docs.slice(i, i + batchSize)

          batchItems.forEach(itemDoc => {
            const itemId = itemDoc.id
            const itemData = itemDoc.data()

            // Create unified item
            const unifiedItem = {
              ...itemData,
              project_id: projectId,
              inventory_status: itemData.inventory_status || 'available'
            }

            // Set in unified collection
            const unifiedItemRef = doc(db, 'items', itemId)
            batch.set(unifiedItemRef, unifiedItem)

            // Delete from legacy location
            const oldItemRef = doc(db, 'projects', projectId, 'items', itemId)
            batch.delete(oldItemRef)
          })

          await batch.commit()
        }

        totalItemsMigrated += itemsSnapshot.docs.length
        totalProjectsProcessed++
      }

      setResult({
        projectsProcessed: totalProjectsProcessed,
        itemsMigrated: totalItemsMigrated
      })

      console.log('✅ Migration completed successfully!')

    } catch (error) {
      console.error('❌ Migration failed:', error)
      setError(`Migration failed: ${error}`)
    } finally {
      setIsRunning(false)
    }
  }

  if (!user) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">You must be authenticated to run the migration.</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Items Migration Tool</h2>
      <p className="text-gray-600 mb-6">
        This tool migrates items from project subcollections to the unified items collection.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800">
            ✅ Migration completed successfully!
            <br />
            • Projects processed: {result.projectsProcessed}
            <br />
            • Items migrated: {result.itemsMigrated}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={validateMigration}
          disabled={isRunning}
          variant="outline"
        >
          Validate Migration
        </Button>

        <Button
          onClick={runMigration}
          disabled={isRunning}
          variant="default"
        >
          {isRunning ? 'Running Migration...' : 'Run Migration'}
        </Button>
      </div>

      {validation && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800">
            📊 Validation Results:
            <br />
            • Projects found: {validation.projects}
            <br />
            • Items to migrate: {validation.totalItems}
          </p>
        </div>
      )}
    </div>
  )
}
