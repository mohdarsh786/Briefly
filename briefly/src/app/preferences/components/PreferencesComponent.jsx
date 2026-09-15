"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";

const predefinedTags = [
  "World News", "Politics", "Economy", "Business", "Technology", 
  "Health", "Environment", "Science", "Education", "Sports",
  "Entertainment", "Culture", "Lifestyle", "Travel", "Crime", 
  "Opinion", "Social Issues", "Innovation", "Human Rights", "Weather"
];

const PreferencesComponent = ({ user }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/preferences');
        const data = await response.json();

        if (data?.preferences?.length > 0) {
          setSelectedTags(data.preferences);
        } else {
          setIsEditing(true);
        }
      } catch (err) {
        setError("Failed to load preferences");
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchPreferences();
  }, [user]);

  const handleTagClick = (tag) => {
    if (!isEditing) return;
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: selectedTags }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save preferences");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to save preferences");
      setLoading(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center"><Loader /></div>;

  if (error) return <div className="max-w-md mx-auto p-4 rounded border">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 rounded-lg shadow">
      
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">{isEditing ? "Select Your Preferred Tags" : "Your Tag Preferences"}</h2>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="inline-flex h-12 animate-shimmer items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] px-6 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50">
            Edit Preferences
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {predefinedTags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            disabled={!isEditing}
            className={`px-4 py-2 rounded transition 
              ${isEditing ? 'cursor-pointer' : 'cursor-default'}
              ${selectedTags.includes(tag) ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}
            `}
          >
            {tag}
          </button>
        ))}
      </div>

      {isEditing && (
        <div className="flex justify-end gap-2">
          <button onClick={handleSubmit} disabled={selectedTags.length === 0} className={`inline-flex h-12 animate-shimmer items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] bg-[length:200%_100%] px-6 font-medium text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 ${selectedTags.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
};

export default PreferencesComponent;