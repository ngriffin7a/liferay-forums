// SPDX-License-Identifier: LGPL-2.1-or-later

/**
 * Grant Forum Object permissions to the Guest and Site Member roles,
 * and create a Service Access Policy to allow unauthenticated (Guest)
 * access to the custom Object headless APIs.
 *
 * Run this script in:
 *   Control Panel → Server Administration → Script (Groovy)
 *
 * Two things are required for Guest access to custom Object APIs:
 *   1. Permissions — Guest role needs VIEW on each ObjectDefinition resource
 *   2. Service Access Policy — a Default SAP entry that allows the
 *      ObjectEntryResourceImpl methods to execute without authentication
 */

import com.liferay.portal.kernel.model.ResourceConstants
import com.liferay.portal.kernel.security.auth.PrincipalThreadLocal
import com.liferay.portal.kernel.service.CompanyLocalServiceUtil
import com.liferay.portal.kernel.service.ResourcePermissionLocalServiceUtil
import com.liferay.portal.kernel.service.RoleLocalServiceUtil
import com.liferay.portal.kernel.service.ServiceComponentLocalServiceUtil
import com.liferay.object.service.ObjectDefinitionLocalServiceUtil
import com.liferay.portal.security.service.access.policy.model.SAPEntry
import com.liferay.portal.security.service.access.policy.service.SAPEntryLocalServiceUtil

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

def SAP_NAME = "FORUM_GUEST_ACCESS"

def FORUM_OBJECT_NAMES = [
    "C_ForumCategory",
    "C_ForumMessage",
    "C_ForumReply",
    "C_ForumVote",
    "C_ForumMessageFlag",
    "C_ForumStatsUser",
    "C_ForumMailingList",
    "C_ForumSuspiciousActivity",
    "C_ForumBan",
]

// Objects that Site Members can create entries in
def SITE_MEMBER_WRITE_NAMES = [
    "C_ForumCategory",
    "C_ForumMessage",
    "C_ForumReply",
    "C_ForumVote",
    "C_ForumMessageFlag",
] as Set

def sapSignatures = "com.liferay.object.rest.internal.resource.v1_0.ObjectEntryResourceImpl#get*"

// ---------------------------------------------------------------------------
// Iterate over all companies
// ---------------------------------------------------------------------------

CompanyLocalServiceUtil.getCompanies().each { company ->

def companyId = company.getCompanyId()
def scope     = ResourceConstants.SCOPE_COMPANY
def primKey   = String.valueOf(companyId)

out.println("=" * 60)
out.println("Forum Object Permission Setup")
out.println("=" * 60)
out.println("")
out.println("Company ID: ${companyId} (${company.getWebId()})")
out.println("")

// ---------------------------------------------------------------------------
// Phase 1: Map Object names → classNames (the resource names)
// ---------------------------------------------------------------------------

def allObjectDefs = ObjectDefinitionLocalServiceUtil.getObjectDefinitions(
    companyId, true, 0
)

// nameToResourceName  — used for VIEW (model resource, company scope)
// nameToPortletResourceName — used for ADD_OBJECT_ENTRY (portlet resource, company scope)
//   format: "com.liferay.object#" + objectDefinitionId (numeric PK)
def nameToResourceName = [:]
def nameToPortletResourceName = [:]

allObjectDefs.each { objDef ->
    nameToResourceName[objDef.getName()] = objDef.getClassName()
    nameToPortletResourceName[objDef.getName()] = "com.liferay.object#" + objDef.getObjectDefinitionId()
}

out.println("--- Forum Object → Resource Name mapping ---")
out.println("")

def discoveredCount = 0
FORUM_OBJECT_NAMES.each { name ->
    def resourceName = nameToResourceName[name]
    if (resourceName) {
        out.println("  ${name} → ${resourceName}")
        out.println("           portlet → ${nameToPortletResourceName[name]}")
        discoveredCount++
    } else {
        out.println("  ⚠️  ${name} — not found")
    }
}

out.println("")
out.println("Found ${discoveredCount} / ${FORUM_OBJECT_NAMES.size()} Forum objects")
out.println("")

if (discoveredCount == 0) {
    out.println("❌ No Forum objects found. Skipping company ${companyId}.")
    out.println("")
    return
}

// ---------------------------------------------------------------------------
// Phase 2: Grant permissions
// ---------------------------------------------------------------------------

out.println("=" * 60)
out.println("Phase 2: Granting permissions")
out.println("=" * 60)
out.println("")

int granted = 0
int skipped = 0
int failed  = 0

// VIEW on ObjectDefinition instances is checked at company scope.
def grantCompanyPermission = { String roleName, String resourceName, String actionId ->
    try {
        def role = RoleLocalServiceUtil.getRole(companyId, roleName)

        ResourcePermissionLocalServiceUtil.addResourcePermission(
            companyId, resourceName, scope, primKey, role.getRoleId(), actionId
        )

        out.println("  ✅ ${roleName} → ${actionId} (company scope)")
        granted++
    }
    catch (com.liferay.portal.kernel.exception.NoSuchRoleException e) {
        out.println("  ❌ Role '${roleName}' not found")
        failed++
    }
    catch (Exception e) {
        out.println("  ❌ ${roleName} → ${actionId} — ${e.class.simpleName}: ${e.message}")
        failed++
    }
}

FORUM_OBJECT_NAMES.each { name ->
    def resourceName = nameToResourceName[name]
    def portletResourceName = nameToPortletResourceName[name]

    if (!resourceName) {
        out.println("⚠️  Skipping ${name} — no ObjectDefinition found")
        skipped++
        return
    }

    out.println("--- ${name} ---")

    // Guest: VIEW (model resource, company scope)
    grantCompanyPermission("Guest", resourceName, "VIEW")

    // Site Member: VIEW (model resource, company scope)
    grantCompanyPermission("Site Member", resourceName, "VIEW")

    // Write actions on applicable objects
    if (SITE_MEMBER_WRITE_NAMES.contains(name)) {
        // ADD_OBJECT_ENTRY is an Application Permission on the portlet resource.
        // Liferay only evaluates it against Regular (company-scoped) roles, not
        // site roles — even when the Object itself is site-scoped. Grant it to
        // the built-in "User" role so every authenticated user can create entries.
        grantCompanyPermission("User", portletResourceName, "ADD_OBJECT_ENTRY")

        // Do NOT grant UPDATE or DELETE to Site Member at company scope.
        // When an Object entry is created, Liferay's ObjectEntryLocalService
        // calls ResourceLocalService.addModelResources(), which grants the
        // creator individual-scope UPDATE and DELETE on their own entry.
        // A company-scope grant here would let any Site Member modify or
        // delete entries they do not own.
    }

    out.println("")
}

out.println("Permissions — Granted: ${granted}  |  Skipped: ${skipped}  |  Failed: ${failed}")
out.println("")

// ---------------------------------------------------------------------------
// Phase 3: Create/Update Service Access Policy for Guest API access
// ---------------------------------------------------------------------------

out.println("=" * 60)
out.println("Phase 3: Service Access Policy for Guest API access")
out.println("=" * 60)
out.println("")

def titleMap = new HashMap<Locale, String>()
titleMap.put(Locale.US, "Forum Guest Access — allows unauthenticated GET on custom Object APIs")

try {
    SAPEntry existingEntry = null
    try {
        existingEntry = SAPEntryLocalServiceUtil.getSAPEntry(companyId, SAP_NAME)
    } catch (Exception e) {
        // Not found — will create
    }

    if (existingEntry) {
        out.println("SAP '${SAP_NAME}' already exists (ID: ${existingEntry.getSapEntryId()})")
        out.println("  Default: ${existingEntry.isDefaultSAPEntry()}")
        out.println("  Enabled: ${existingEntry.isEnabled()}")
        out.println("  Signatures: ${existingEntry.getAllowedServiceSignatures()}")

        if (!existingEntry.isDefaultSAPEntry() || !existingEntry.isEnabled()) {
            existingEntry.setDefaultSAPEntry(true)
            existingEntry.setEnabled(true)
            existingEntry.setAllowedServiceSignatures(sapSignatures)
            SAPEntryLocalServiceUtil.updateSAPEntry(existingEntry)
            out.println("  ✅ Updated — set Default=true, Enabled=true")
        } else {
            out.println("  ✅ Already configured correctly")
        }
    } else {
        def userId = Long.parseLong(PrincipalThreadLocal.getName())

        SAPEntryLocalServiceUtil.addSAPEntry(
            userId,                  // userId
            sapSignatures,           // allowedServiceSignatures
            true,                    // defaultSAPEntry (applies to unauthenticated)
            true,                    // enabled
            SAP_NAME,                // name
            titleMap,                // titleMap
            new com.liferay.portal.kernel.service.ServiceContext()
        )

        out.println("  ✅ Created SAP '${SAP_NAME}'")
        out.println("     Default: true (applies to unauthenticated requests)")
        out.println("     Signatures: ${sapSignatures}")
    }
} catch (Exception e) {
    out.println("  ❌ SAP creation failed: ${e.class.simpleName}: ${e.message}")
}

out.println("")
out.println("=" * 60)
out.println("Done — Company ${companyId} (${company.getWebId()})")
out.println("=" * 60)
out.println("")

} // end companies loop
