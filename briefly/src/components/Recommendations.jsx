import { useCallback, useEffect, useState } from "react";
import { IconCaretUpFilled, IconCaretDownFilled } from "@tabler/icons-react";
import Link from "next/link";
import Tag from "./Tag";

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${hours}:${minutes} | ${day}/${month}/${year}`;
}

function Recommendations(selectedTags) {
  const [articles, setArticles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastKey, setLastKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nextImageLoading, setNextImageLoading] = useState(false);

  const fetchArticles = useCallback(
    async (key) => {
      setLoading(true);
      const res = await fetch(
        `/api/recommendation?lastKey=${key ? JSON.stringify(key) : ""}` +
          `&tags=${
            selectedTags ? JSON.stringify(selectedTags.selectedTags) : ""
          }`
      );
      console.log(res)
      const data = await res.json();
      console.log(data)

      setArticles((prevArticles) => [...prevArticles, ...data.articles]);
      setLastKey(data.lastKey);
      setLoading(false);
    },
    [setLastKey, setArticles, setLoading, selectedTags]
  );

  useEffect(() => {
    setArticles([]);
    setCurrentIndex(0);
    setLastKey(null);
    fetchArticles();
  }, [fetchArticles, selectedTags]);
  
  const nextArticle = () => {
    if (currentIndex < articles.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
    } else if (lastKey && !loading) {
      fetchArticles(lastKey);
    }
  };

  const previousArticle = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prevIndex) => prevIndex - 1);
    }
  };

  const currentArticle = articles[currentIndex];

  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (articles[nextIndex] && articles[nextIndex].image_url) {
      const img = new Image();
      img.src = articles[nextIndex].image_url;
      img.onload = () => setNextImageLoading(false);
      setNextImageLoading(true);
    }
  }, [currentIndex, articles]);

  return (
    <div className="h-full container mx-auto p-6 flex flex-col sm:flex-row items-center">
      {loading && articles.length === 0 ? (
        <div className="h-full w-full rounded-lg  bg-gray-100 dark:bg-neutral-800 animate-pulse"></div>
      ) : currentArticle ? (
        <div className="h-full flex flex-col lg:flex-row items-center p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg ">
          {/* <Image
            src={currentArticle.image_url}
            alt={currentArticle.title}
            height={200}
            width={300}
            className="max-w-80 max-h-80 object-fill rounded-lg mr-8"
          /> */}
          <img
            src={currentArticle.image_url}
            alt={currentArticle.title}
            className="max-w-80 max-h-80 object-fill rounded-lg mr-8"
          ></img>
          <div className="flex-1">
            <h2 className="mt-4 lg:mt-0 text-justify text-xl md:text-2xl lg:text-5xl mb-6 font-semibold dark:text-gray-100">
              <Link href={currentArticle.url}> {currentArticle.title} </Link>
            </h2>
            <div className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Author: {currentArticle.author}
            </div>
            <div className="tags-container flex flex-wrap mt-2">
              {currentArticle.tags &&
                currentArticle.tags.map((tag, index) => (
                  <Tag key={index} tag={tag} />
                ))}
            </div>

            <p className="text-justify text-base 2xl:text-xl text-gray-700 dark:text-gray-300 mt-2">
              {currentArticle.content}
            </p>
            <div className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              Published: {formatDate(currentArticle.published_date)}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full rounded-lg  bg-gray-100 dark:bg-neutral-800 animate-pulse">
          <p>No more articles available.</p>
        </div>
      )}

      <div className="flex flex-row sm:flex-col ml-4 mt-4 sm:mt-0">
        <button
          onClick={previousArticle}
          disabled={currentIndex === 0}
          className="-rotate-90 sm:rotate-0 sm:mb-2 px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-full disabled:opacity-50"
        >
          <IconCaretUpFilled />
        </button>
        <button
          onClick={nextArticle}
          disabled={loading && currentIndex === articles.length - 1}
          className="-rotate-90 sm:rotate-0 sm:mt-2 px-4 py-2 bg-blue-500 dark:bg-blue-700 rounded-full disabled:opacity-50"
        >
          <IconCaretDownFilled />
        </button>
      </div>
    </div>
  );
}

export default Recommendations;
