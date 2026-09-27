# Syrian Smart Address

Yes. For this project, the key is to tell Lovable not to build a simple “drop a pin and save an address” application. It needs a hierarchical location model capable of understanding a physical site, building, multiple entrances, floors, individual units, delivery points, loading docks, businesses, farms, temporary addresses, permissions, and different purposes.

Below is the prompt I would use for the first serious Lovable build.

Build a Production-Ready Syrian Smart Address Network

Build a complete, production-ready Syrian Smart Address Network: a digital addressing and location infrastructure platform that allows individuals, businesses, organizations, couriers, farms, warehouses, institutions, and other users to create, manage, verify, search, share, and resolve precise digital addresses across Syria.

This is NOT simply a map-pin application.

The platform must solve the complete addressing problem:

Where is the property? → Which building? → Which entrance? → Which floor? → Which unit? → Which access point should be used for this particular purpose?

The system must support locations where conventional street addresses are incomplete, inconsistent, informal, unavailable, or based heavily on landmarks.

The platform should eventually be usable by:

Residents

Businesses

E-commerce companies

Courier companies

Logistics operators

Restaurants

Hotels

Hospitals

Clinics

Universities

Schools

Factories

Warehouses

Farms

Utilities

Telecom companies

Banks

Insurance companies

Taxi and mobility companies

Emergency services

Municipalities

Government institutions

Syrian Post

Developers through APIs

The first version should be a standalone Smart Address Network.

Do NOT make it dependent on a parcel-delivery system.

Parcel/logistics systems may integrate with it later through APIs.

1. Fundamental Product Principle

Do NOT model an address as:

address = latitude + longitude

Instead model:

GEOGRAPHIC LOCATION
        │
        ▼
PROPERTY / SITE
        │
        ▼
BUILDING
        │
 ┌──────┼───────────────┐
 ▼      ▼               ▼
Entrance A        Entrance B       Loading Gate
 │
 ▼
Floor
 │
 ▼
Unit
 │
 ├── Apartment
 ├── Office
 ├── Shop
 ├── Clinic
 └── Other

Different parts of the same physical property can have different purposes.

Example:

A building may have:

Main public entrance

Residents entrance

Delivery entrance

Service entrance

Parking entrance

Emergency entrance

Loading dock

Staff entrance

Entrance that must NOT be used for deliveries

The platform must understand these differences.

2. Address Hierarchy

Use a flexible hierarchical model.

Support:

Country
→ Governorate
→ City/Town/Village
→ District
→ Neighborhood
→ Street/Road
→ Site/Property
→ Building
→ Entrance/Access Point
→ Floor/Level
→ Unit

Not every location requires every level.

For example, a farm might be:

Governorate
→ Village
→ Farm
→ Main Gate
→ Field / Building

A warehouse might be:

Industrial Zone
→ Property
→ Warehouse
→ Truck Gate
→ Loading Dock

A shopping mall:

Mall
→ Entrance
→ Floor
→ Shop

A residential tower:

Building
→ Entrance
→ Floor
→ Apartment

The schema must support all of these without creating separate incompatible address systems.

3. Core Location Entity

Create a generalized hierarchical location_nodes model.

Each location node should contain approximately:

id

parent_id

organization_id where applicable

node_type

display_name

Arabic name

English name

public smart code

internal identifier

latitude

longitude

optional geometry

governorate

city

district

neighborhood

street

landmark

description

verification status

confidence score

public/private visibility

created_by

created_at

updated_at

active status

Supported node types should include:

property

land

building

entrance

gate

floor

apartment

office

shop

clinic

warehouse

loading_dock

parking_entrance

delivery_point

service_entrance

emergency_entrance

farm

field

factory

school

hospital

hotel

government_office

locker

pickup_point

POI

custom

Design this so additional node types can be added later.

4. Buildings

A building is a physical geographic object.

A building should support:

Building Smart Address

Map location

Optional building footprint

Name

Number if available

Property type

Number of floors

Number of entrances

Accessibility

Elevator availability

Public notes

Private notes

Verification

Confidence score

Photos where permitted

Important:

Do NOT assign different fake GPS coordinates to every apartment.

The building has geographic coordinates.

Individual units exist hierarchically inside the building.

5. Multiple Entrances

This is CRITICAL.

One building may have several entrances.

Example:

BUILDING
 │
 ├── Entrance A
 │
 ├── Entrance B
 │
 ├── Residents Entrance
 │
 ├── Delivery Entrance
 │
 ├── Parking Entrance
 │
 ├── Service Entrance
 │
 ├── Emergency Entrance
 │
 └── Loading Dock

Each entrance/access point can have its own:

GPS coordinate

Name

Type

Accessibility

Opening hours

Instructions

Photo

Verification status

The entrance GPS coordinate should represent where someone should physically navigate.

6. Entrance Purpose Rules

Do NOT assume every entrance can be used for every purpose.

Each entrance should support allowed and prohibited purposes.

Example:

Entrance A

Visitors: YES
Residents: YES
Deliveries: NO
Emergency: YES
Wheelchair access: YES
Vehicles: NO

Example:

Loading Gate

Visitors: NO
Parcel Delivery: YES
Freight Delivery: YES
Trucks: YES
Emergency: NO

Create an access_purposes model.

Supported purposes should include:

visitor

resident

parcel_delivery

food_delivery

freight

taxi_pickup

taxi_dropoff

emergency

wheelchair_access

employee

customer

parking

service

maintenance

utility

loading

custom

A location resolver should be able to answer:

Which entrance should be used for parcel delivery?

and return the appropriate access point.

7. Entrance Restrictions

Allow explicit restrictions.

Examples:

No deliveries

Residents only

Staff only

Closed after 18:00

Trucks prohibited

Pedestrian only

Vehicle only

Emergency only

Temporary closure

This is extremely important.

A courier must NEVER automatically be routed to the nearest entrance if that entrance prohibits deliveries.

8. Floors

Buildings can contain floors.

Support:

Basement levels

Ground floor

Mezzanine

Positive floors

Roof

Custom labels

Examples:

B2
B1
G
M
1
2
3
...
Roof

Do not assume floor numbering conventions are identical across every building.

Store:

internal floor ID

displayed floor label

numeric sort order

optional local description

9. Apartments and Units

Each floor can contain multiple units.

Unit types:

Apartment

Office

Shop

Clinic

Classroom

Hotel room

Storage

Workshop

Government office

Other

Example hierarchy:

Building SY-DAM-X7K9
        │
        └── Entrance B
               │
               └── Floor 4
                      │
                      ├── Apartment 12
                      ├── Apartment 13
                      └── Office 14

Every unit can receive its own Smart Address.

The Smart Address should resolve internally to:

Building
→ Entrance
→ Floor
→ Unit

but should NOT expose that entire hierarchy publicly unless authorized.

10. Buildings Without Formal Apartment Numbers

Many properties may not have standardized unit numbering.

Support descriptions such as:

First door right

Second door left

Rear apartment

Upper apartment

Apartment above shop

Door opposite elevator

Store:

unit_label

separately from standardized internal identifiers.

Later, the platform may assign an internal standardized unit number without forcing users to change the familiar local description.

11. Smart Address Codes

Every addressable node may receive a Smart Address.

Examples:

SY-DAM-K7X4
SY-ALE-82KF
SY-HOM-9M4Q

For units, generate secure non-obvious codes.

Do NOT expose personal information in codes.

Do NOT create codes such as:

DAM-MEZ-BUILDING4-FLOOR3-APT12

Instead use something like:

SY-DAM-7K4P-Q9

The code resolves through the database.

Use UUIDs internally.

Smart codes are public aliases, never database primary keys.

Codes must:

Be case-insensitive

Avoid confusing characters where practical

Have collision detection

Support QR representation

Be immutable unless explicitly retired

Support redirects if changed

12. Different Address Purposes

A user should be able to create addresses for different objectives.

Examples:

Home

"My home"

Delivery

"Delivery entrance"

Business

"My office"

Customer entrance

"Clinic patient entrance"

Warehouse

"Warehouse receiving"

Freight

"Truck loading dock"

Taxi

"Pickup point"

Emergency

"Emergency access"

Farm

"Farm gate"

Temporary

"Temporary delivery location"

The same physical location can therefore have multiple context-specific destinations.

13. Address Resolver

Create a central Address Resolution Engine.

Input:

Smart Address + Purpose

Example:

SY-DAM-7K4P
purpose = parcel_delivery

Output:

Building:
ABC Tower

Recommended access point:
Delivery Entrance

Navigation coordinates:
...

Restrictions:
No deliveries through Main Entrance

Instructions:
Use eastern service road.

Another request:

purpose = visitor

could return:

Main Visitor Entrance

This is one of the fundamental differentiators of the platform.

14. Search

Users must be able to search by:

Smart Address

Business name

Organization name

Place name

Category

Neighborhood

Street

Landmark

Arabic spelling

English spelling

Transliteration

Common aliases

Example searches:

شركة النور
Al Noor
Al-Nour
Nour Company

should be capable of resolving to the same verified business where appropriate.

15. Business Search

Businesses can choose to publish their Smart Address.

Example result:

Al Noor Medical Center
مركز النور الطبي

Damascus — Mazzeh

✓ Verified Business

Smart Address
SY-DAM-K7X4

Visitor Entrance
Entrance A

Floor
3

Office
305

[Directions]
[Share]
[Copy Address]

Business profiles should support:

Arabic name

English name

aliases

category

logo

phone

website

opening hours

Smart Address

visitor entrance

delivery entrance

accessibility

verification

16. Residential Privacy

Residential addresses MUST be private by default.

Searching a person's name must NEVER reveal their home address.

Searching a building must NOT expose resident names or apartment occupancy.

Public information may include:

building

public entrances

public businesses

Private information includes:

resident

apartment association

phone

private instructions

intercom

access instructions

Implement strict server-side permissions.

17. Address Sharing

Users can share their address through:

Smart Address code

QR code

secure link

map

temporary delivery token

Allow:

Copy Smart Address

Share

Show QR

Navigate

Create Temporary Address

18. Temporary Address Tokens

Create privacy-preserving temporary addresses.

Example:

SY-TMP-K82M9

User chooses:

One use

24 hours

48 hours

7 days

Custom expiration

Temporary token resolves only the information required for its authorized purpose.

Example:

purpose = delivery

After expiration or successful use:

EXPIRED

This allows users to receive deliveries without permanently exposing their home address to every merchant.

19. Purpose-Based Disclosure

Build attribute-level permissions.

Example:

A courier might receive:

Building
Entrance
Floor
Unit
Delivery instructions

but NOT:

Resident full profile
Personal account information
Address history
Other saved addresses

A taxi service may receive only:

Passenger pickup entrance
GPS

A freight company may receive:

Truck gate
Loading dock
Access hours
Vehicle restrictions

This is fundamental.

20. QR Codes

Every public Smart Address can generate a QR code.

Scanning QR should open the Smart Address page.

For buildings:

QR may confirm:

✓ You are at the correct building.

For authorized delivery:

Destination:
Entrance B
Floor 4
Unit 12

QR codes must contain a URL/token, not sensitive raw data.

21. Map

Use a provider-neutral map architecture.

Prefer OpenStreetMap-compatible technology initially.

Do not permanently couple the database to a single map provider.

Support:

Map view

Satellite provider later

Drop pin

Move pin

Entrance pins

Property/building pins

Current location where permission is granted

Navigation link

Nearby addresses

Nearby businesses

Use separate coordinates for:

Building

and:

Entrance/access point

where applicable.

22. Address Creation Wizard

Create an extremely simple wizard.

Step 1

What are you creating?

Home

Business

Office

Shop

Building

Warehouse

Farm

Other

Step 2

Find the location.

Search

Use current location

Drop pin manually

Step 3

Does the building/property already exist?

If YES:

Select it.

If NO:

Create it.

Step 4

Select or add entrance.

Step 5

What is this entrance used for?

Step 6

Add floor if applicable.

Step 7

Add unit if applicable.

Step 8

Add optional landmark/instructions.

Step 9

Choose privacy.

Step 10

Generate Smart Address.

Then show:

Your Smart Address

SY-DAM-K7X4-Q9

[Copy]
[QR]
[Share]
[Directions]

23. Prevent Duplicate Buildings

Before creating a building, check for nearby existing buildings.

If another building exists within a configurable radius:

A building may already exist here.

Is this your building?

[Building A]
[Building B]

[None of these]

Do NOT silently create duplicates.

24. Duplicate Address Resolution

Create a system for:

duplicate reports

merge candidates

admin review

redirect old Smart Address

preserve history

Never simply delete addresses that may already be shared externally.

25. Verification

Create verification levels.

Unverified

User-created.

User Confirmed

Owner/resident confirmed.

Community Confirmed

Multiple independent confirmations.

Courier Verified

Successful logistics visit.

Business Verified

Business ownership/location verified.

Organization Verified

Institution verified.

Official Verified

Reserved for future authorized government/municipal verification.

Do not display misleading verification badges.

26. Address Confidence Score

Create a deterministic confidence score initially.

Possible factors:

Accurate GPS pin

Entrance pin

User confirmation

Business verification

Successful visit

Successful delivery

Multiple independent confirmations

Courier verification

Duplicate reports

Failed navigation

Conflicting information

Example:

Address Confidence
94 / 100

High Confidence

Do NOT equate confidence with identity verification.

Keep them separate.

27. Corrections

Users should be able to report:

Wrong building pin

Wrong entrance

Entrance closed

Delivery prohibited

Wrong floor

Business moved

Duplicate location

Incorrect name

Incorrect opening hours

Unsafe access

Other

Corrections must not immediately overwrite verified information.

Use moderation/review rules.

28. Successful Visit Feedback

Create an API/event:

location.visit_success

Authorized services can report:

Smart Address
Purpose
Entrance used
Successful/failed
Timestamp

Do NOT expose customer identity.

This can improve confidence scores and entrance recommendations.

29. Farms

Support rural locations properly.

Example:

Farm
 │
 ├── Main Gate
 ├── Truck Gate
 ├── Farmhouse
 ├── Storage
 ├── Greenhouse
 └── Field

A farm can therefore have:

Farm Smart Address

plus individual operational points.

30. Warehouses and Factories

Support:

Industrial Property
 │
 ├── Visitor Gate
 ├── Employee Gate
 ├── Truck Gate
 ├── Warehouse A
 │      └── Loading Dock 1
 ├── Warehouse B
 └── Administration

Freight navigation should route trucks to the correct gate and dock.

31. Hospitals

Support complex sites:

Hospital
 │
 ├── Main Entrance
 ├── Emergency
 ├── Ambulance Entrance
 ├── Staff Entrance
 ├── Pharmacy
 ├── Building A
 └── Building B

A request with:

purpose = emergency

should resolve differently from:

purpose = visitor

32. Universities and Campuses

Support:

University
 │
 ├── Main Gate
 ├── Student Gate
 ├── Faculty Building
 ├── Administration
 ├── Library
 └── Parking

The system must support nested sites, not merely buildings.

33. Accessibility

Access points should support:

wheelchair accessible

stairs

ramp

elevator

accessible parking

restricted mobility

notes

Users should optionally request:

purpose = visitor
accessibility = wheelchair

Resolver should prefer an appropriate entrance.

34. Opening Hours

Entrances may have different opening hours.

Example:

Main Entrance
08:00–22:00

Delivery Entrance
08:00–16:00

Emergency Entrance
24/7

The resolver should consider availability.

Do not route someone to a currently closed entrance when a valid alternative exists.

35. Address Favorites

Users can save:

Home

Work

Parents

Warehouse

Office

Customer

Supplier

Custom

These are private labels belonging to the user.

They are not part of the public address.

36. Business Claiming

Businesses should be able to:

Claim this business

Workflow:

Business discovered
      ↓
Claim
      ↓
Verification
      ↓
Approved
      ↓
Business manages profile

Never allow an unverified user to overwrite a business location.

37. Business Locations

Organizations can have multiple branches.

Example:

Company X

Damascus Branch
SY-DAM-...

Aleppo Branch
SY-ALE-...

Homs Warehouse
SY-HOM-...

Search should clearly distinguish them.

38. Search Ranking

Rank business/location results based on:

Exact name

Verified status

Geographic relevance

Alias match

Category

Confidence

Popularity

Searcher's location where permission exists

Never rank private residential addresses publicly.

39. Arabic Address Intelligence

Build data structures to support Syrian Arabic address variations.

Examples:

المزة
Mezzeh
Mazzeh
Mezze

These may represent the same area.

Support:

Arabic normalization

English transliteration

alternative spelling

aliases

common local names

historical/common neighborhood names

Do not automatically merge locations based solely on AI similarity.

Use confidence + human review.

40. Landmark-Based Addressing

Landmarks are extremely important.

Support:

Near Al-X Mosque
Opposite Y Pharmacy
Behind Z School
Next to ABC Market

Store landmarks as structured references where possible.

Users should be able to select nearby known landmarks.

41. API

Build a versioned API architecture.

Example:

/api/v1/

Endpoints should conceptually support:

GET /addresses/{smartCode}

POST /addresses

POST /addresses/resolve

POST /addresses/validate

GET /businesses/search

GET /locations/search

GET /addresses/{smartCode}/access-points

POST /temporary-addresses

POST /verification

POST /visit-feedback

Do not expose private data through public API endpoints.

42. Purpose-Aware Resolution API

Example:

GET /api/v1/addresses/SY-DAM-K7X4/resolve?purpose=parcel_delivery

Possible response:

{
  "smart_code": "SY-DAM-K7X4",
  "purpose": "parcel_delivery",
  "recommended_access_point": {
    "name": "Delivery Entrance",
    "latitude": "...",
    "longitude": "..."
  },
  "restrictions": [
    "Do not use main entrance"
  ],
  "verified": true,
  "confidence": 94
}

43. Developer Platform

Prepare:

API keys

Sandbox keys

Production keys

Rate limits

API logs

Webhooks

Documentation

Usage analytics

Potential future API customers:

Couriers

Marketplaces

Taxi apps

Food delivery

Banks

Utilities

Telecom

Government

44. Privacy Architecture

Privacy is NON-NEGOTIABLE.

Implement:

Private residential addresses by default

Purpose-based access

Temporary tokens

Expiring permissions

Minimal data disclosure

Server-side authorization

Audit logs

User-controlled sharing

Address deletion/deactivation workflows

Consent records where appropriate

Never expose apartment/resident information through search engines.

45. Security

Implement:

Supabase Row Level Security

Server-side authorization

Secure sessions

Rate limiting

Abuse protection

API scopes

Secure temporary tokens

Audit logs

Input validation

Secure file uploads

Sensitive-field protection

Enumeration resistance

Do not allow someone to enumerate:

SY-DAM-0001
SY-DAM-0002
SY-DAM-0003

to discover private locations.

Use non-sequential Smart Address codes.

46. Audit Logs

Log important actions:

Address created

Address edited

Entrance changed

Unit created

Business claimed

Verification changed

Privacy changed

Temporary address created

API resolution

Admin override

Address merged

Address retired

Include:

Actor

Timestamp

Action

Resource

Organization

Metadata

47. User Roles

Support:

User

Creates/manages own addresses.

Business Owner

Manages business locations.

Organization Manager

Manages multiple locations.

Courier/Logistics Partner

Limited purpose-based resolution access.

Verifier

Can verify permitted information.

Moderator

Reviews corrections/duplicates.

Platform Admin

Platform management.

Never give ordinary business users unrestricted residential address access.

48. Admin Control Center

Create:

Dashboard

Addresses
Buildings
Businesses
Entrances
Corrections
Duplicates
Verification
Reports
Users
Organizations
API Clients
Abuse
Audit Logs
System Settings

Dashboard metrics:

Smart Addresses created

Buildings mapped

Entrances mapped

Businesses

Verified addresses

Cities covered

Temporary addresses

API resolutions

Corrections pending

Duplicate candidates

49. Geographic Coverage

Start with Syria.

Database should support:

Damascus

Rural Damascus

Aleppo

Homs

Hama

Latakia

Tartus

Idlib

Daraa

As-Suwayda

Quneitra

Raqqa

Deir ez-Zor

Al-Hasakah

Do NOT hard-code the platform to these values.

Use configurable geographic data.

50. Country-Ready Architecture

Although launching in Syria, architect the system so another country could be added later.

Example prefixes:

SY-DAM-...
LB-BEY-...
JO-AMM-...
IQ-BGD-...

Do not make Syria-specific assumptions in the core database.

Syria should be the first deployment, not an architectural limitation.

51. Arabic-First Design

Arabic is the primary language.

Support English fully.

Requirements:

Proper RTL

Correct Arabic typography

Arabic search

English search

Transliteration-aware search

RTL maps/forms/cards

Arabic/English business profiles

Do not create an English UI and simply flip it into RTL.

Design Arabic intentionally.

52. Mobile-First

Most address creation will happen on smartphones.

Prioritize:

Large map

Easy pin movement

GPS button

Simple forms

Large actions

QR

Share

Navigation

Address creation should be possible in under two minutes for a normal residential address.

53. PWA

Make the product installable as a Progressive Web App where practical.

Support:

Home-screen installation

Cached basic UI

Graceful weak-connectivity behavior

Do not assume perfect internet connectivity.

54. Database

Use Supabase/PostgreSQL.

Create normalized entities approximately including:

users
profiles

organizations
organization_members

location_nodes
location_aliases
location_geometries

buildings
building_metadata

access_points
access_point_purposes
access_restrictions
access_hours

floors
units

smart_addresses
smart_address_redirects

businesses
business_locations
business_claims

address_permissions
address_shares
temporary_addresses

verifications
confidence_events

correction_reports
duplicate_candidates

visit_feedback

favorites

api_clients
api_keys
api_usage

audit_logs

Do not duplicate the same physical location across unrelated tables unnecessarily.

Maintain a coherent hierarchical model.

55. PostGIS Readiness

If Supabase supports PostGIS in the project, use it appropriately.

Prepare for:

nearest location

locations within radius

duplicate proximity detection

geographic search

entrance proximity

business search near location

Do not overengineer complex geospatial infrastructure in the MVP.

56. Address Ownership vs Address Reality

This distinction is extremely important.

A physical building exists independently of a user's account.

Do NOT make:

User owns building → deleting user deletes building

Instead:

Physical Location
      │
      ├── Claims
      ├── Managers
      ├── Residents
      └── Businesses

Deleting an account should not destroy shared geographic infrastructure.

57. Do Not Allow Users to Claim Entire Buildings Accidentally

A resident adding Apartment 12 should NOT automatically become administrator of the entire building.

Permissions should be scoped.

Example:

Resident:

Apartment 12

Business:

Office 305

Building manager:

Building + entrances + common areas

Organization:

Owned facility

58. Address History

Keep history.

If:

entrance changes

business moves

street name changes

unit numbering changes

preserve previous records.

A Smart Address should either:

continue resolving correctly

or

redirect to a replacement.

Never silently break addresses that may appear on invoices, websites, business cards or packages.

59. Address Lifecycle

Support:

Draft
Active
Verified
Under Review
Temporarily Unavailable
Moved
Merged
Retired

Retired addresses should return meaningful status rather than generic 404.

60. Emergency Architecture

Prepare for future emergency-service integration.

Emergency responders may eventually need different routing than normal visitors.

Example:

purpose = emergency

could resolve:

Emergency gate

Ambulance entrance

building access

known restrictions

Do NOT expose private emergency data publicly.

This should only become operational through authorized partnerships.

61. Utility Architecture

Prepare for future utility addressing.

Example:

Property
 │
 ├── Electricity meter
 ├── Water meter
 └── Telecom connection

Do NOT implement full utility integration now.

Only ensure the location model can support it later.

62. Do Not Turn This Into a Social Network

Avoid:

public resident profiles

public home reviews

public household information

unnecessary social features

The product is location infrastructure.

Privacy and utility come first.

63. Do Not Turn This Into Another Google Maps Clone

Do NOT attempt to recreate:

worldwide POI discovery

restaurant reviews

traffic

navigation engine

street imagery

Use existing map infrastructure.

Our differentiation is:

precise structured addresses + hierarchical locations + entrances + floors + units + purpose-aware access + verification + APIs.

64. MVP

The first working version should include:

Authentication

Arabic/English

Map

Current location

Drop pin

Create property/building

Add multiple entrances

Entrance purpose/restrictions

Add floors

Add apartments/offices/shops

Generate Smart Address

QR

Share

Resolve Smart Address

Business creation

Business search

Public/private controls

Temporary addresses

Verification

Confidence score

Corrections

Duplicate detection

Admin dashboard

Basic API

Purpose-aware address resolution

Do not prioritize advanced AI before these work reliably.

65. Required End-to-End Tests

Before considering MVP complete, test these scenarios.

Scenario A — Apartment

Create:

Damascus
→ Building
→ Entrance B
→ Floor 4
→ Apartment 12

Generate Smart Address.

Resolve it.

Correct entrance must appear.

Scenario B — Wrong Delivery Entrance

Building has:

Entrance A:
Visitors YES
Deliveries NO

Entrance B:
Visitors YES
Deliveries YES

Resolve with:

purpose = parcel_delivery

System MUST return Entrance B.

Never Entrance A merely because it is geographically closer.

Scenario C — Business

Create:

Medical Center
→ Building
→ Visitor Entrance
→ Floor 3
→ Office 305

Search business name.

Correct Smart Address and visitor entrance must appear.

Scenario D — Warehouse

Create:

Warehouse
→ Visitor Gate
→ Truck Gate
→ Loading Dock

Resolve:

purpose = freight

Return Truck Gate/Loading Dock.

Scenario E — Temporary Residential Address

Create temporary delivery address.

Courier resolves authorized delivery information.

After expiration:

Resolution must fail safely.

Scenario F — Privacy

Search resident name.

NO residential address must appear.

Attempt unauthorized API request for apartment information.

Request MUST fail.

Scenario G — Duplicate Building

Attempt to create building on top of existing building.

System warns user and offers existing location.

Scenario H — Closed Entrance

Delivery entrance closes at 16:00.

Another valid delivery entrance is open.

Resolver should recommend the open valid entrance.

66. UX Principle

A normal user should never need to understand the underlying complexity.

Creating a home address should feel like:

Find building
     ↓
Choose entrance
     ↓
Choose floor
     ↓
Enter apartment
     ↓
Done

The complexity belongs in the architecture—not the interface.

67. Product Positioning

Position the product as:

Syria's Digital Address Infrastructure

The promise:

One precise Smart Address for every place.

And for businesses:

Find the correct place, entrance and destination—not merely a map pin.

68. Final Architecture Principle

Build this as an independent infrastructure platform.

It must work without:

Parcel OS

Merchant Payment OS

Government integration

Courier partnerships

But expose clean APIs so all of those systems can integrate later.

Future architecture:

                    SMART ADDRESS NETWORK

                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
     Parcel OS          E-commerce            Mobility
        │                    │                    │
        ├─────────────── API ┼────────────────────┤
        │                    │                    │
      Banks              Utilities            Government
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    LOCATION GRAPH
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
        Buildings        Businesses         Sites
            │
        Entrances
            │
          Floors
            │
          Units

The long-term asset is not the website.

The long-term asset is the verified, privacy-preserving, purpose-aware location graph and its API.

Build the MVP accordingly.

How I would use this in Lovable

Give Lovable the master prompt first. Do not ask it to build everything in one uncontrolled pass. After it creates the architecture, work through the MVP in modules: authentication/database → map → building hierarchy → entrances → floors/units → Smart Codes → privacy → search/businesses → verification → API → admin.

There are three areas I would inspect especially carefully after Lovable builds them: Supabase RLS/privacy, the hierarchical building → entrance → floor → unit data model, and the purpose-aware entrance resolver. Those are the parts where a superficially working implementation can hide serious architectural mistakes.

One design decision is especially important: do not force every user to create an apartment-level address. Someone should be able to create a Smart Address for a farm gate, shop entrance, building, warehouse loading dock, office, meeting point, taxi pickup point, or simply a precise map location. The hierarchy should become more detailed only when the location requires it.

That is what turns this from an address-book application into genuine digital location infrastructure.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smart-syria-nav.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0808873-5be3-4f55-927c-ee922e090461).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
