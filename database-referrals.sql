-- SQL to create the referrals table for probation and youth services
-- Run this in your Supabase SQL editor

CREATE TABLE referrals (
    id BIGSERIAL PRIMARY KEY,
    referral_date DATE DEFAULT CURRENT_DATE,
    
    -- Youth Information
    youth_name TEXT NOT NULL,
    youth_gender TEXT,
    youth_age INTEGER,
    youth_dob DATE,
    csp_identified BOOLEAN DEFAULT FALSE,
    current_placement TEXT,
    length_of_stay TEXT,
    placement_reason TEXT,
    
    -- Parent/Guardian Information
    parent_name TEXT,
    parent_phone TEXT,
    parent_address TEXT,
    
    -- Crossover Information
    crossover_status TEXT, -- e.g. "State Ward", "Voluntary", "Intake/Pending", "N/A"
    caseworker_name TEXT,
    caseworker_phone TEXT,
    
    -- Professional Team
    probation_officer TEXT,
    probation_district TEXT,
    probation_phone TEXT,
    probation_email TEXT,
    judge_name TEXT,
    county TEXT,
    attorney_name TEXT,
    gal_name TEXT,
    casa_name TEXT,
    other_team_member TEXT,
    
    -- Level of Service
    service_type TEXT, -- "Treatment" or "Non-Treatment"
    service_duration TEXT, -- "Short Term" or "Long Term"
    primary_placement TEXT,
    secondary_placement TEXT,
    special_accommodations TEXT,
    service_comments TEXT,
    
    -- Assessment
    strengths TEXT,
    interests TEXT,
    pro_social_activities TEXT,
    positive_supports TEXT,
    
    -- Meta
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for the intake form)
CREATE POLICY "Allow anonymous inserts" ON referrals FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated users to read all (for admin dashboard)
CREATE POLICY "Allow authenticated users to select all" ON referrals FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update (for admin status changes)
CREATE POLICY "Allow authenticated users to update all" ON referrals FOR UPDATE TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_referrals_youth_name ON referrals(youth_name);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_referral_date ON referrals(referral_date);

-- Insert sample data from the provided image
INSERT INTO referrals (
    referral_date,
    youth_name,
    youth_gender,
    youth_age,
    youth_dob,
    csp_identified,
    current_placement,
    length_of_stay,
    placement_reason,
    parent_name,
    parent_phone,
    parent_address,
    crossover_status,
    probation_officer,
    probation_district,
    probation_phone,
    probation_email,
    judge_name,
    county,
    attorney_name,
    service_type,
    service_duration,
    primary_placement,
    secondary_placement,
    special_accommodations,
    service_comments,
    strengths,
    interests,
    pro_social_activities,
    positive_supports
) VALUES (
    '2026-03-26',
    'Walter Primes',
    'Male',
    16,
    '2009-11-12',
    true,
    'Home',
    'N/A',
    'Due to his ongoing behaviors within the home, school, day reporting etc., Judge has ordered probation to make group home applications in and out of state.',
    'Tina Hill-Crawford',
    '402-968-4980',
    '5212 Bedford Ave, Omaha, NE, 68104',
    'N/A',
    'Cody Sherry',
    'District 4J',
    '402-657-4225',
    'cody.sherry@nejudicial.gov',
    'Daniels',
    'Douglas',
    'Grace Halstead',
    'Non-Treatment',
    'Long Term',
    'Group Home A',
    'Group Home B',
    'NA',
    'NA',
    'Walter can be respectful when he wants to be. Walter is attending therapy weekly. Walter is mostly attending day reporting. Walter usually will admit to doing something if he did it.',
    'Unknown what Walter’s interests are besides video games.',
    'None',
    'Adoptive mother Tina, community youth coach Dwight, therapist, and Tina''s fiancé.'
);
